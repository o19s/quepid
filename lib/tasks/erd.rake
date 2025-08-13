# frozen_string_literal: true

namespace :erd_markdown do
  desc 'Generate ERD markdown file from erd.mmd for GitHub rendering'
  task :generate => :environment do
    mmd_path = Rails.root.join('docs', 'diagrams', 'erd.mmd')
    md_path = Rails.root.join('docs', 'diagrams', 'erd.md')
    
    unless File.exist?(mmd_path)
      puts "Error: #{mmd_path} not found. Please run 'rails rails_lens:update' first."
      exit 1
    end
    
    # Read the mermaid content
    mermaid_content = File.read(mmd_path)
    
    # Create the markdown content with proper formatting
    markdown_content = <<~MARKDOWN
      # Quepid Database Entity Relationship Diagram
      
      This document provides a visual representation of the Quepid database schema using a Mermaid ERD diagram.
      
      ## Overview
      
      The ERD below shows all tables in the Quepid database along with their relationships. The diagram includes:
      
      - Core application tables (User, Case, Query, etc.)
      - Authentication and security tables (ApiKey, etc.)
      - Analytics tables (Ahoy::Visit, Ahoy::Event)
      - Background job processing tables (SolidQueue::*)
      - File storage tables (ActiveStorage::*)
      - Admin/monitoring tables (Blazer::*)
      
      ## Entity Relationship Diagram
      
      ```mermaid
      #{mermaid_content}
      ```
      
      ## Table Groups
      
      The diagram organizes tables into logical groups:
      
      ### Core Application
      - **User**: User accounts and authentication
      - **Case**: Search evaluation cases
      - **Query**: Search queries within cases
      - **Rating**: Query relevance ratings
      - **Scorer**: Scoring algorithms
      - **Try**: Search engine configuration attempts
      
      ### Teams & Collaboration
      - **Team**: User teams
      - **TeamMember**: Team membership
      - **TeamCase**: Cases shared with teams
      - **TeamScorer**: Scorers shared with teams
      
      ### Analytics & Tracking
      - **Ahoy::Visit**: User visit tracking
      - **Ahoy::Event**: User event tracking
      - **QueryLog**: Query execution logs
      
      ### Background Processing
      - **SolidQueue**: Background job processing tables
      
      ### File Storage
      - **ActiveStorage**: File upload and storage tables
      
      ### Admin & Monitoring
      - **Blazer**: SQL query builder and dashboard tables
      
      ## Regenerating This Diagram
      
      To regenerate this diagram after schema changes:
      
      ```bash
      # First, ensure rails_lens annotations are up to date
      bundle exec rails rails_lens:update
      
      # Then generate this markdown file
      bundle exec rails erd_markdown:generate
      ```
      
      The ERD is automatically updated after database migrations in development.
    MARKDOWN
    
    # Write the markdown file
    File.write(md_path, markdown_content)
    
    puts "Successfully generated ERD markdown at #{md_path}"
  end

  # Enhance rails_lens:update task to automatically run erd_markdown:generate afterward
  if Rake::Task.task_defined?('rails_lens:update')
    Rake::Task['rails_lens:update'].enhance do
      Rake::Task['erd_markdown:generate'].invoke
    end
  end
end
