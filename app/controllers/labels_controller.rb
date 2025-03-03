# frozen_string_literal: true
# 
class LabelsController < ApplicationController
  #include Turbo::Streams::TurboStreamsTagBuilder
  include ActionController::Live

  
  
  def generate
    @case = Case.find(params[:id])
    generator = LabelGenerator.new
    queries = @case.queries
    query_texts = queries.map(&:query_text).join(", ")
    #@labels = ["Science Fiction", "Space Opera", "Celestial Bodies"]
    @labels = generator.generate_labels(query_texts)
    render layout: false
    
  end
  
  def generateold
    @case = Case.find(params[:id])
    generator = LabelGenerator.new
    queries = @case.queries
    query_texts = queries.map(&:query_text).join(", ")
    @labels = ["Science Fiction", "Space Opera", "Celestial Bodies are warm"]
    #@labels = generator.generate_labels(query_texts)
    #render layout: false
    #turbo_stream.update('my_data', replacement: render_to_string('generate.html.erb'))
    
    Turbo::StreamsChannel.broadcast_append_to(
      "my_data",
      target: "labels_containers",
      partial: "books/label",
      locals: { labels: @labels }
    )
    
    render layout: false
    
    
  end
    
  def generate22
      @case = Case.find(params[:id])
      generator = LabelGenerator.new
      respond_to do |format|
        format.turbo_stream do
          queries = @case.queries
          queries.each_slice(2) do |query_batch|
            query_texts = query_batch.map(&:query_text).join(", ")
            labels = generator.generate_labels(query_texts)
            
            Turbo::StreamsChannel.broadcast_append_to(
              "case_#{@case.id}_labels",
              target: "labels_container",
              partial: "books/label",
              locals: { labels: labels }
            )
          end
        end
      end
    end
    
  
  def generate2
    
    generator = LabelGenerator.new
    
    kase = Case.find(params[:case_id])
    queries = kase.queries.order('RAND()').limit(100)
    
    response.headers["Content-Type"] = "text/vnd.turbo-stream.html"
      
    query_texts = queries.map(&:query_text).join(", ")
    labels = generator.generate_labels(query_texts)
    
    Turbo::StreamsChannel.broadcast_append_to(
      "case_#{kase.id}_labels",
      target: "labels_container",
      partial: "labels/label_batch",
      locals: { labels: labels }
    )

  end
end
