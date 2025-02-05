# frozen_string_literal: true

require 'faraday'
require 'faraday/follow_redirects'

# rubocop:disable Metrics/ClassLength
class FetchService
  # include ProgressIndicator

  attr_reader :logger, :options

  # These are two snapshots related to book 25 and case 6789
  # that represent Haystack Conference and are used in the sample
  # Jupyterlite notebooks.  Don't nuke them if they belong to a case 6789.
  HAYSTACK_PUBLIC_CASE = 6789
  SPECIAL_SNAPSHOTS_TO_PRESERVE = [ 2471, 2473 ].freeze

  def initialize opts = {}
    default_options = {
      logger:                     Rails.logger,
      snapshot_limit:             10,
      snapshot_webrequests_limit: 1,
      debug_mode:                 false,
    }

    @options = default_options.merge(opts)

    @logger = @options[:logger]
  end

  def begin acase, atry
    @case = acase
    @try = atry

    @snapshot = @case.snapshots.build(name: 'Fetch [BEGUN]')
    @snapshot.scorer = @case.scorer
    @snapshot.try = @try
    @snapshot.save!

    @snapshot
  end

  # rubocop:disable Metrics/MethodLength
  # should be in some other service!
  def extract_docs_from_response_body_for_solr response_body
    docs = []
    response = JSON.parse(response_body)

    explain_json = nil
    explain_json = response['debug']['explain'] if response['debug'] && response['debug']['explain']

    response['response']['docs'].each_with_index do |doc_json, index|
      doc = {}
      doc[:id] = doc_json['id']
      unless explain_json.nil?
        explain = explain_json[doc_json['id']]
        doc[:explain] = explain.to_json if explain.present?
      end
      doc[:position] = index + 1
      doc[:rated_only] = nil
      doc[:fields] = doc_json.except('id')

      docs << doc
    end

    docs
  end
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def setup_docs_for_query query, docs
    results = []

    return results if docs.blank?
    return results if query.blank?

    docs = normalize_docs_array docs
    docs = docs.sort { |d1, d2| d1[:position].to_i <=> d2[:position].to_i }

    docs.each_with_index do |doc, index|
      doc[:explain] = doc[:explain].to_json if doc[:explain].is_a?(Hash)

      doc_params = {
        doc_id:     doc[:id],
        explain:    doc[:explain],
        position:   doc[:position] || (index + 1),
        rated_only: doc[:rated_only] || false,
        fields:     doc[:fields].blank? ? nil : doc[:fields].to_json,
      }
      results << query.snapshot_docs.build(doc_params)
    end

    results
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

  # This maybe should be split out into a snapshot_query and a snapshot_docs?
  def store_query_results query, docs, response_status, response_body
    snapshot_query = @snapshot.snapshot_queries.create(
      query:             query,
      number_of_results: docs.count,
      response_status:   response_status
    )
    snapshot_query.create_web_request(
      response_status: response_status,
      response:        response_body
    )
    snapshot_manager = SnapshotManager.new(@snapshot)
    query_docs = snapshot_manager.setup_docs_for_query(snapshot_query, docs)
    SnapshotDoc.import query_docs

    snapshot_query.reload # without this we get duplicate sets of snapshot_docs

    snapshot_query
  end

  def score_run
    @snapshot.name = 'Fetch [PREPARE_SCORE]'
    @snapshot.save!
    score_data = score_snapshot @snapshot, @try

    case_score_manager = CaseScoreManager.new @case
    case_score_manager.update score_data
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  # rubocop:disable Metrics/BlockLength
  # rubocop:disable Layout/LineLength
  def score_snapshot snapshot, try
    queries_detail = {}

    snapshot.snapshot_queries.each do |snapshot_query|
      javascript_scorer = JavascriptScorer.new(Rails.root.join('lib/scorer_logic.js'))

      # Prepare some items to score
      doc_ratings = {}
      snapshot_query.query.ratings.each do |rating|
        doc_ratings[rating.doc_id] = rating.rating
      end

      # Some Scorers will need access to the document data as well, so add that
      docs = snapshot_query.snapshot_docs.map do |snapshot_doc|
        { id: snapshot_doc.doc_id, rating: doc_ratings[snapshot_doc.doc_id] }.merge(JSON.parse(snapshot_doc.fields))
      end

      best_docs = snapshot_query.query.ratings.map do |rating|
        { id: rating.doc_id, rating: rating.rating }
      end

      best_docs.sort_by! { |doc| doc[:rating] }.reverse

      # docs = [
      #  { id: 1, value: 10, rating: 3 },
      #  { id: 2, value: 20, rating: 0 }
      # ]

      # Calculate score with options
      begin
        scorer = snapshot.scorer
        code = scorer.code

        score = javascript_scorer.score(docs, best_docs, code)
        # puts "the score is #{score}"
        # puts "nan?  #{score.nan?}" if score.is_a? Float
        if score.is_a?(Float) && score.nan?
          # snapshot_query.query.notes ||= ""
          # snapshot_query.query.notes << "\n Fetch Service Snapshot #{snapshot_query.snapshot.id}"
          # snapshot_query.query.notes << "\n Fetch Service Snapshot Query #{snapshot_query.id}, #{snapshot_query.query.query_text}"

          # snapshot_query.query.notes << "\n Score was NaN"
          # snapshot_query.query.save!
          # TODO: Confirm with David Fisher this is right.
          # Appears to happen when your docs are all rated 0 and your best docs are all 0
          score = 0
        end
        snapshot_query.score = score

        unless snapshot_query.save
          snapshot_query.query.notes ||= ''
          snapshot_query.query.notes << "\n Fetch Service Snapshot #{snapshot_query.snapshot.id}"
          snapshot_query.query.notes << "\n Fetch Service Snapshot Query #{snapshot_query.query.query_text}"

          snapshot_query.query.notes << "\n #{snapshot_query.errors.full_messages}"
          snapshot_query.query.save!
        end
      rescue JavascriptScorer::ScoreError => e
        puts "Scoring failed: #{e.message}"
      end

      queries_detail[snapshot_query.query_id] =
        { score: snapshot_query.score, text: snapshot_query.query.query_text }
    end

    # Opportunity here to fix the averaging logic
    # at the case level.
    if queries_detail.any?
      scores = queries_detail.values.map { |q| q[:score] }
      average_score = scores.sum.to_f / scores.length
    else
      average_score = 0.0
    end

    score_data = {
      all_rated:  nil,
      queries:    queries_detail,
      score:      average_score,
      scorer_id:  @case.scorer.id,
      try_number: try.try_number,
      user_id:    nil,
    }

    score_data
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Metrics/BlockLength
  # rubocop:enable Layout/LineLength

  def complete
    @snapshot.name = 'Fetch [CHECKING SNAPSHOTS COUNT]'
    @snapshot.save!

    delete_extra_snapshots @case

    @snapshot.name = 'Fetch [CHECKING WEBREQUESTS COUNT]'
    @snapshot.save!

    delete_extra_web_requests @case

    @snapshot.name = 'Fetch [COMPLETED]'
    @snapshot.save!
  end

  def delete_extra_snapshots kase
    # Keep the first snapshot, and the most recents, deleting the ones out of the middle.
    # Not the best sampling!
    if kase.snapshots.count > @options[:snapshot_limit]

      snapshots_to_delete = kase.snapshots[1..((@options[:snapshot_limit] * -1) + kase.snapshots.count)]
      snapshots_to_delete = filter_haystack_special_snapshot(snapshots_to_delete)
      snapshots_to_delete.each(&:destroy!)
    end
  end

  def delete_extra_web_requests kase
    snapshots_with_web_requests = kase.snapshots
      .joins(snapshot_queries: :web_request)
      .distinct
      .order(created_at: :desc)
      .offset(@options[:snapshot_webrequests_limit])

    snapshots_with_web_requests.each do |snapshot|
      WebRequest.joins(snapshot_query: :snapshot)
        .where(snapshots: { id: snapshot.id })
        .delete_all
    end
  end

  # rubocop:disable Metrics/MethodLength
  def get_connection url, debug_mode, credentials, custom_headers
    connection = Faraday.new(url: url) do |faraday|
      # Configure the connection options, such as headers or middleware
      faraday.response :follow_redirects
      faraday.response :logger, nil, { headers: debug_mode, bodies: debug_mode, errors: !Rails.env.test? }
      faraday.ssl.verify = false

      faraday.headers['Content-Type'] = 'application/json'
      unless credentials.nil?
        username, password = credentials.split(':')
        faraday.headers['Authorization'] = "Basic #{Base64.strict_encode64("#{username}:#{password}")}"
      end

      if custom_headers.present?
        JSON.parse(custom_headers).to_h.each do |key, value|
          faraday.headers[key] = value
        end
      end
      faraday.adapter Faraday.default_adapter
    end
    connection
  end
  # rubocop:enable Metrics/MethodLength

  def make_request atry, query
    return mock_response if @options[:fake_mode]
    return handle_missing_endpoint(atry) if atry.search_endpoint.nil?

    setup_connection(atry.search_endpoint)
    response = execute_request(atry, query)
    response
  end

  # rubocop:disable Metrics/PerceivedComplexity
  def replace_values data, query_text
    if data.is_a?(Hash)
      data.each do |key, value|
        if '#$query##' == value
          data[key] = query_text
        elsif value.is_a?(Hash) || value.is_a?(Array)
          replace_values(value, query_text)
        end
      end
    elsif data.is_a?(Array)
      data.each { |item| replace_values(item, query_text) }
    end
    data
  end
  # rubocop:enable Metrics/PerceivedComplexity

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Layout/LineLength
  def mock_response_body
    mock_statedecoded_body = '{
      "responseHeader":{
        "zkConnected":true,
        "status":0,
        "QTime":0,
        "params":{
          "q":"*:*",
          "fl":"id,text",
          "start":"0",
          "rows":"10"}},
      "response":{"numFound":20148,"start":0,"docs":[
          {
            "id":"l_11730",
            "text":"For the purpose of this chapter:\n\n&quot;Claimant&quot; means the person filing a claim pursuant to this chapter.\n\n&quot;Commission&quot; means the Virginia Workers&apos; Compensation Commission.\n\n&quot;Crime&quot; means an act committed by any person in the Commonwealth of Virginia which would constitute a crime as defined by the Code of Virginia or at common law. However, no act involving the operation of a motor vehicle which results in injury shall constitute a crime for the purpose of this chapter unless the injuries (i) were intentionally inflicted through the use of such vehicle or (ii) resulted from a violation of § 18.2-51.4 or 18.2-266 or from a felony violation of § 46.2-894.\n\n&quot;Family,&quot; when used with reference to a person, means (i) any person related to such person within the third degree of consanguinity or affinity, (ii) any person residing in the same household with such person, or (iii) a spouse.\n\n&quot;Sexual abuse&quot; means sexual abuse as defined in subdivision 6 of § 18.2-67.10 and acts constituting rape, sodomy, object sexual penetration or sexual battery as defined in Article 7 (§ 18.2-61 et seq.) of Chapter 4 of Title 18.2.\n\n&quot;Victim&quot; means a person who suffers personal physical injury or death as a direct result of a crime including a person who is injured or killed as a result of foreign terrorism or who suffers personal emotional injury as a direct result of being the subject of a violent felony offense as defined in subsection C of § 17.1-805, or stalking as described in § 18.2-60.3, or attempted robbery or abduction."},
          {
            "id":"l_5780",
            "text":"Agencies authorized under any other law to issue grading, building, or other permits for activities involving land-disturbing activities regulated under this article may not issue any such permit unless the applicant submits with his application an approved erosion and sediment control plan and certification that the plan will be followed and, upon the development of an online reporting system by the Department but no later than July 1, 2014, evidence of Virginia stormwater management state permit coverage where it is required. Prior to issuance of any permit, the agency may also require an applicant to submit a reasonable performance bond with surety, cash escrow, letter of credit, any combination thereof, or such other legal arrangement acceptable to the agency, to ensure that measures could be taken by the agency at the applicant&apos;s expense should he fail, after proper notice, within the time specified to initiate or maintain appropriate conservation action which may be required of him by the approved plan as a result of his land-disturbing activity. The amount of the bond or other security for performance shall not exceed the total of the estimated cost to initiate and maintain appropriate conservation action based on unit price for new public or private sector construction in the locality and a reasonable allowance for estimated administrative costs and inflation which shall not exceed 25 percent of the estimated cost of the conservation action. If the agency takes such conservation action upon such failure by the permittee, the agency may collect from the permittee for the difference should the amount of the reasonable cost of such action exceed the amount of the security held. Within 60 days of the achievement of adequate stabilization of the land-disturbing activity in any project or section thereof, the bond, cash escrow, letter of credit or other legal arrangement, or the unexpended or unobligated portion thereof, shall be refunded to the applicant or terminated based upon the percentage of stabilization accomplished in the project or section thereof. These requirements are in addition to all other provisions of law relating to the issuance of such permits and are not intended to otherwise affect the requirements for such permits."},
          {
            "id":"l_16271",
            "text":"If in the administration of this article a question concerning compliance with standards of practice governing any health care profession arises pursuant to Subtitle III (§ 54.1-2400 et seq.) of Title 54.1, the Commissioner or his designee shall consult with the appropriate health regulatory board within the Department of Health Professions."},
          {
            "id":"l_4010",
            "text":"The production of documentary material in response to a civil investigative demand served under this article shall be made under a sworn certificate, in such form as the demand designates, by (i) in the case of a natural person, the person to whom the demand is directed, or (ii) in the case of a person other than a natural person, a person having knowledge of the facts and circumstances relating to such production and authorized to act on behalf of such person. The certificate shall state that all of the documentary material required by the demand and in the possession, custody, or control of the person to whom the demand is directed has been produced and made available to the investigator identified in the demand.\n\nAny person upon whom any civil investigative demand for the production of documentary material has been served shall make such material available for inspection and copying to the investigator identified in such demand at the principal place of business of such person, or at such other place as the investigator and the person thereafter may agree and prescribe in writing, or as the court may direct. Such material shall be made available on the return date specified in such demand, or on such later date as the investigator may prescribe in writing. Such person may, upon written agreement between the person and the investigator, substitute copies for originals of all or any part of such material."},
          {
            "id":"l_5552",
            "text":"For purposes of computing fire protection or law-enforcement employees&apos; entitlement to overtime compensation, all hours that an employee works or is in a paid status during his regularly scheduled work hours shall be counted as hours of work. The provisions of this section pertaining to law-enforcement employees shall only apply to such employees of an employer of 100 or more law-enforcement employees."},
          {
            "id":"l_725",
            "text":"There is hereby created a political subdivision and public body corporate and politic of the Commonwealth of Virginia to be known as the Fort Monroe Authority, to be governed by a Board of Trustees (Board) consisting of 12 voting members appointed as follows: the Secretary of Natural Resources, the Secretary of Commerce and Trade, and the Secretary of Veterans Affairs and Homeland Security, or their successor positions if those positions no longer exist, from the Governor&apos;s cabinet; the member of the Senate of Virginia and the member of the House of Delegates representing the district in which Fort Monroe lies; two members appointed by the Hampton City Council; and five nonlegislative citizen members appointed by the Governor, four of whom shall have expertise relevant to the implementation of the Fort Monroe Reuse Plan, including but not limited to the fields of historic preservation, tourism, environment, real estate, finance, and education, and one of whom shall be a citizen representative from the Hampton Roads region. Cabinet members and elected representatives shall serve terms commensurate with their terms of office. Citizen appointees shall initially be appointed for staggered terms of either one, two, or three years, and thereafter shall serve for four-year terms. Cabinet members shall be entitled to send their deputies or another cabinet member, and legislative members another legislator, to meetings as full voting members in the event that official duties require their presence elsewhere.\n\nThe Board so appointed shall enter upon the performance of its duties and shall initially and annually thereafter elect one of its members as chairman and another as vice-chairman. The Board shall also elect annually a secretary, who shall be a member of the Board, and a treasurer, who need not be a member of the Board, or a secretary-treasurer, who need not be a member of the Board. The chairman, or in his absence the vice-chairman, shall preside at all meetings of the Board, and in the absence of both the chairman and vice-chairman, the Board shall elect a chairman pro tempore who shall preside at such meetings. Seven Trustees shall constitute a quorum, and all action by the Board shall require the affirmative vote of a majority of the Trustees present and voting, except that any action to amend or terminate the existing Reuse Plan, or to adopt a new Reuse Plan, shall require the affirmative vote of 75 percent or more of the Trustees present and voting. The members of the Board shall be entitled to reimbursement for expenses incurred in attendance upon meetings of the Board or while otherwise engaged in the discharge of their duties. Such expenses shall be paid out of the treasury of the Authority in such manner as shall be prescribed by the Authority."},
          {
            "id":"l_2980",
            "text":"No provision of this chapter imposing any liability shall apply to any act done or omitted in good faith in conformity with any rule, regulation, or interpretation thereof by the Commission or by the Federal Reserve Board or officer or employee duly authorized by the Board to issue such interpretation or approvals under the comparable provisions of the federal Equal Credit Opportunity Act, (15 U.S.C. § 1691 et seq.), and regulations thereunder, notwithstanding that after such act or omission has occurred, such rule, regulation, or interpretation is amended, rescinded, or determined by judicial or other authority to be invalid for any reason."},
          {
            "id":"l_25249",
            "text":"<section prefix=\'A\'>In this section, &quot;document of rescission&quot; means a document stating that an identified satisfaction, certificate of satisfaction, or affidavit of satisfaction of a security instrument was recorded erroneously or fraudulently, the secured obligation remains unsatisfied, and the security instrument remains in force.</section><section prefix=\'B\'>If a person records a satisfaction, certificate of satisfaction, or affidavit of satisfaction of a security instrument in error or by fraud, the person may execute and record a document of rescission. Upon recording, the document rescinds an erroneously recorded satisfaction, certificate, or affidavit.</section><section prefix=\'C\'>A recorded document of rescission has no effect on the rights of a person who:<section prefix=\'1\'>Acquired an interest in the real property described in a security instrument after the recording of the satisfaction, certificate of satisfaction, or affidavit of satisfaction of the security instrument and before the recording of the document of rescission; and</section><section prefix=\'2\'>Would otherwise have priority over or take free of the lien created by the security instrument under the laws of the Commonwealth of Virginia.</section></section><section prefix=\'D\'>A person, other than the clerk of the circuit court or any of his employees or other governmental official in the course of the performance of his recordation duties, who erroneously, fraudulently, or wrongfully records a document of rescission is subject to liability under § 55-66.3.</section>"},
          {
            "id":"l_1063",
            "text":"<section prefix=\'A\'>All state public bodies created in the executive branch of state government and subject to the provisions of this chapter shall make available the following information to the public upon request and shall post such information on the Internet:<section prefix=\'1\'>A plain English explanation of the rights of a requester under this chapter, the procedures to obtain public records from the public body, and the responsibilities of the public body in complying with this chapter. For purposes of this subdivision &quot;plain English&quot; means written in nontechnical, readily understandable language using words of common everyday usage and avoiding legal terms and phrases or other terms and words of art whose usage or special meaning primarily is limited to a particular field or profession;</section><section prefix=\'2\'>Contact information for the person designated by the public body to (i) assist a requester in making a request for records or (ii) respond to requests for public records;</section><section prefix=\'3\'>A general description, summary, list, or index of the types of public records maintained by such state public body;</section><section prefix=\'4\'>A general description, summary, list, or index of any exemptions in law that permit or require such public records to be withheld from release; and</section><section prefix=\'5\'>Any policy the public body has concerning the type of public records it routinely withholds from release as permitted by this chapter or other law.</section></section><section prefix=\'B\'>The Freedom of Information Advisory Council, created pursuant to § 30-178, shall assist in the development and implementation of the provisions of subsection A, upon request.</section>"},
          {
            "id":"l_20837",
            "text":"<section prefix=\'A\'>The Inspector shall administer the laws and regulations and shall have access to all records and properties necessary for this purpose. He shall perform all duties delegated by the Director pursuant to § 45.1-161.5 and maintain permanent records of the following:<section prefix=\'1\'>Each application for a gas, oil, or geophysical operation and each permitted gas, oil, or geophysical operation;</section><section prefix=\'2\'>Meetings, actions and orders of the Board;</section><section prefix=\'3\'>Petitions for mining coal within 200 feet of or through a well;</section><section prefix=\'4\'>Requests for special plugging by a coal owner or coal operator; and</section><section prefix=\'5\'>All other records prepared pursuant to this chapter.</section></section><section prefix=\'B\'>The Inspector shall serve as the principal executive of the staff of the Board.</section><section prefix=\'C\'>The Inspector may take charge of well or corehole, or pipeline emergency operations whenever a well or corehole blowout, release of hydrogen sulfide or other gases, or other serious accident occurs.</section>"}]
      }}
    '

    mock_statedecoded_body
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Layout/LineLength

  # rubocop:disable Layout/LineLength
  def filter_haystack_special_snapshot snapshots_to_delete
    snapshots_to_delete = snapshots_to_delete
      .reject { |snapshot| SPECIAL_SNAPSHOTS_TO_PRESERVE.include?(snapshot.id) && HAYSTACK_PUBLIC_CASE == snapshot.case.id }
    snapshots_to_delete
  end
  # rubocop:enable Layout/LineLength

  private

  # Not sure we need this!
  def normalize_docs_array docs
    return [] if docs.blank?

    result = docs.map do |each|
      each = each.to_unsafe_h if each.is_a?(ActionController::Parameters)
      each = each.to_hash     if each.is_a?(ActiveSupport::HashWithIndifferentAccess)

      each.symbolize_keys! if each.present?
    end.compact

    result
  end

  def create_error_response message
    Faraday::Response.new(
      status:           400,
      body:             { error: message }.to_json,
      response_headers: { 'Content-Type' => 'application/json' }
    )
  end

  def mock_response
    body = mock_response_body
    Faraday::Response.new(status: 200, body: body)
  end

  def handle_missing_endpoint atry
    create_error_response("No search endpoint defined for try number #{atry.try_number}")
  end

  def setup_connection search_endpoint
    return if @connection

    @connection = get_connection(
      search_endpoint.endpoint_url,
      @options[:debug_mode],
      search_endpoint.basic_auth_credential,
      search_endpoint.custom_headers
    )
  end

  def execute_request atry, query
    endpoint = atry.search_endpoint
    http_verb = normalize_http_verb(endpoint.api_method)

    case http_verb
    when :get  then execute_get_request(endpoint, atry, query)
    when :post then execute_body_request(:post, endpoint, atry, query)
    when :put  then execute_body_request(:put, endpoint, atry, query)
    else
      raise ArgumentError, "Invalid HTTP verb: #{http_verb}"
    end
  end

  def normalize_http_verb verb
    case verb.upcase
    when 'JSONP', 'GET' then :get
    when 'POST' then :post
    when 'PUT'  then :put
    else verb.downcase.to_sym
    end
  end

  def execute_get_request endpoint, atry, query
    @connection.get do |req|
      req.url create_url endpoint, atry
      process_get_params(req, atry.args, query)
    end
  end

  # rubocop:disable Layout/LineLength
  def create_url endpoint, atry
    "#{endpoint.endpoint_url}?debug=true&debug.explain.structured=true&wt=json&rows=#{atry.number_of_rows}#{append_fl(atry.field_spec)}"
  end
  # rubocop:enable Layout/LineLength

  # should probably be in its own class
  def append_fl str
    return nil if str.blank?

    fields = str.split(/[\s,]+/)
      .map { |field| field.include?(':') ? field.split(':').second : field }
      .compact_blank
      .join(',')

    "&fl=#{fields}"
  end

  def process_get_params req, args, query
    puts args
    args.each do |key, values|
      values.each do |val|
        val.gsub!('#$query##', query.query_text)
        req.params[key] = val
      end
    end
  end

  def execute_body_request method, endpoint, atry, query
    # need to deal with number_of_rows here
    @connection.public_send(method) do |req|
      req.url endpoint.endpoint_url
      req.body = prepare_request_body(atry.args, query)
    end
  end

  def prepare_request_body args, query
    processed_args = replace_values(args, query.query_text)
    processed_args.to_json
  end
end
# rubocop:enable Metrics/ClassLength
