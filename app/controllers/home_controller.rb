# frozen_string_literal: true

class HomeController < ApplicationController
  def show
    # https://www.gamecreatures.com/blog/2023/03/07/rails-add-turbo-hotwire-to-existing-sprockets-application/
    @turbo = true
    # @cases = @current_user.cases.not_archived.includes([ :scores ])
    @cases = @current_user.cases_involved_with.not_archived

    @most_recent_cases = @current_user.cases_involved_with.not_archived.recent.limit(4).sort_by(&:case_name)

    @most_recent_books = []
    @lookup_for_books = {}
    # we really should be looking at when judgements were made, not just book updates.
    # a last_judged_at field
    @current_user.books_involved_with.order(:updated_at).limit(4).each do |book|
      @most_recent_books << book
      judged_by_current_user = book.judgements.where(user: @current_user).count
      if judged_by_current_user.positive? && judged_by_current_user < book.query_doc_pairs.count
        @lookup_for_books[book] = book.query_doc_pairs.count - judged_by_current_user
      end
    end

    @most_recent_books.sort_by!(&:name)

 
  end
  
  def bob
    @case = Case.new
    render :layout => false
  end
  
  def cases
    @cases = @current_user.cases_involved_with.not_archived
    render :layout => false
  end
  
  def grouped_cases
    @cases = @current_user.cases_involved_with.not_archived
    # Homepage is too slow so we have to cut some stuff out ;-(
    candidate_cases = @cases.select { |kase| kase.scores.scored.count.positive? }
    @grouped_cases = candidate_cases.group_by { |kase| kase.case_name.split(':').first }
    @grouped_cases = @grouped_cases.select { |_key, value| value.count > 1 }    
    render :layout => false    
  end
  
  def youruncle
    
    file = params[:case][:upload].read
    data = JSON.parse(file)
    puts data
    #file_data = params[:case][:upload].tempfile
    #File.read(file_data, 'r') do |file|  
    #  person = JSON.parse(file)
    #  puts person
    #end
    
    redirect_to admin_users_url, notice: 'User account was successfully deleted.'
  end
end
