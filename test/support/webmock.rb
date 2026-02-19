# rubocop:disable Style/FrozenStringLiteralComment

WebMock.disable_net_connect!(allow_localhost: true)

module ActiveSupport
  class TestCase
    # rubocop:disable Metrics/MethodLength
    # rubocop:disable Metrics/AbcSize
    def setup
      mock_statedecoded_body = '
      {
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

      # rubocop:disable Style/RedundantRegexpEscape
      stub_request(
        :any,
        %r{http\://www.google-analytics\.com/\_\_utm\.gif\?.*}
      )
      # rubocop:enable Style/RedundantRegexpEscape

      stub_request(
        :get,
        'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=*:*&rows=10&start=0'
      )
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Host'            => 'solr.quepidapp.com:8983',
            'User-Agent'      => 'Ruby',
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body)

      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=tiger?&rows=10&start=0')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=can%20I%20own%20a%20tiger&rows=10&start=0')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=I%20like%20?%20marks,%20do%20you%20like%20?%20marks?&rows=10&start=0')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q&rows=10&start=0')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      stub_request(
        :get,
        'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=*:*&rows=10&start=0'
      )
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Host'            => 'solr.quepidapp.com:8983',
            'User-Agent'      => 'Ruby',
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body)

      stub_request(
        :get,
        'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id&q=served&rows=1&start=0'
      )
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Host'            => 'solr.quepidapp.com:8983',
            'User-Agent'      => 'Ruby',
          }
        )
        .to_return(status: 200, body: '
        {
  "responseHeader":{
    "zkConnected":true,
    "status":0,
    "QTime":1,
    "params":{
      "q":"served",
      "fl":"id",
      "start":"0",
      "rows":"1"}},
  "response":{"numFound":1552,"start":0,"docs":[
      {
        "id":"l_13688"}]
  }}

      ')

      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=legal&rows=10&start=0')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body)

      stub_request(:post, 'http://solr.quepidapp.com:8983/solr/statedecoded/select')
        .with(
          body:    '{"query":"trek","key2":"value2"}',
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body)

      # Stub for verifying that Authorization and custom headers are forwarded
      stub_request(:post, 'http://solr.quepidapp.com:8983/solr/statedecoded/with_auth')
        .with(
          body:    '{"query":"trek"}',
          headers: {
            'Authorization'   => 'Basic dGVzdDp0ZXN0', # Base64 of 'test:test'
            'X-Custom-Header' => 'test-value',
            'Content-Type'    => 'application/json',
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body)

      # demonstrate following redirects
      stub_request(:get, 'https://example.com/old-url')
        .to_return(status: 302, headers: { 'Location' => 'https://example.com/new-location' })

      stub_request(:get, 'https://example.com/new-location')
        .to_return(status: 200, body: mock_statedecoded_body)

      # Demonstrate server error
      stub_request(:get, 'https://localhost:9999/')
        .to_raise(Faraday::ConnectionFailed.new('Failed to connect'))

      # Testing out handline of café as a non ascii character
      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select?fl=id,text&q=At%20dusk,%20the%20caf%C3%A9%20transformed%20into%20an%20impromptu%20stage&rows=10&start=0')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'Cookie'          => '',
            'Https'           => 'off',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: '', headers: {})

      # Testing out fetch service using
      # search_endpoint   for_case_queries_case
      # try               for_case_queries_case
      stub_request(:get, 'http://test.com/solr/tmdb/select?debug=true&debug.explain.structured=true&fl=id,title&q=First%20Query&rows=10&start=0&wt=json')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      # Testing out fetch service using
      # search_endpoint   for_case_queries_case
      # try               for_case_queries_case with custom field_spec
      stub_request(:get, 'http://test.com/solr/tmdb/select?debug=true&debug.explain.structured=true&fl=id,title,img_500x500,name,brand,product_type&q=First%20Query&rows=10&start=0&wt=json')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      # Testing out fetch service using
      # search_endpoint   for_case_queries_case
      # try               es_try_with_curator_vars
      stub_request(:post, 'http://test.com:9200/tmdb/_search')
        .with(
          body:    { 'query'=>{ 'multi_match'=>{ 'fields' => 'title, overview', 'query' => 'First Query', 'tie_breaker' => '1' } } },
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 200, body: mock_statedecoded_body, headers: {})

      # Testing out fetch service using
      # search_endpoint   for_case_queries_case
      # try               es_try_with_curator_vars
      # query             blowup_query
      stub_request(:get, 'http://test.com/solr/tmdb/select?debug=true&debug.explain.structured=true&fl=id,title&q=BLOWUP_QUERY&rows=10&start=0&wt=json')
        .with(
          headers: {
            'Accept'          => '*/*',
            'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
            'Content-Type'    => 'application/json',
            'User-Agent'      => /Faraday/,
          }
        )
        .to_return(status: 404, body: '', headers: {})

      # Test out calls to OpenAI for judging
      # beware that the content: attribute has nested text that is itself more JSON and you need to strip any new lines.
      chat_completion_body = <<~TEXT
        {"id": "chatcmpl-Apgkot75TcZxjtOudaRkqzVmpCSBS",
          "object": "chat.completion",
          "created": 1736882438,
          "model": "gpt-4-0613",
          "choices": [
            {
              "index": 0,
              "message": {
                "role": "assistant",
                "content": "{\\"explanation\\": \\"This document explicitly states that it has nothing to do with farm animals and will not discuss them at all, making it irrelevant to the user's query concerning farm animals.\\",  \\"judgment\\": 0}",
                "refusal": null
              },
              "logprobs": null,
              "finish_reason": "stop"
            }
          ],
          "usage": {
            "prompt_tokens": 372,
            "completion_tokens": 50,
            "total_tokens": 422,
            "prompt_tokens_details": {
              "cached_tokens": 0,
              "audio_tokens": 0
            },
            "completion_tokens_details": {
              "reasoning_tokens": 0,
              "audio_tokens": 0,
              "accepted_prediction_tokens": 0,
              "rejected_prediction_tokens": 0
            }
          },
          "service_tier": "default",
          "system_fingerprint": null
        }
      TEXT

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => 'Bearer 1234asdf5678' })
        .to_return(status: 200, body: chat_completion_body, headers: {})

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => 'Bearer BAD_OPENAI_KEY' })
        .to_return(status: 401, body: 'Unauthorized')
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => 'Bearer OPENAI_429_ERROR' })
        .to_return(status: 429, body: 'Too Many Requests')
    end

    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Metrics/AbcSize
  end
end

# rubocop:enable Style/FrozenStringLiteralComment
