# Agentic JavaScript Extraction Workflow

## Overview

This document describes the implementation of an agentic workflow for JavaScript extraction in Quepid, following patterns from the [RubyLLM agentic workflows guide](https://rubyllm.com/agentic-workflows/).

## Background

The original JavaScript extraction process had a single-attempt approach:
1. Download HTML from a search results page
2. Generate JavaScript functions to parse the HTML
3. Execute the functions using `JavascriptMapper` tool

This worked well when the JavaScript generation succeeded on the first try, but failed when:
- The generated JavaScript had syntax errors
- The parsing logic didn't match the HTML structure
- Complex regex patterns weren't supported by the V8 engine
- The functions returned 0 results when data was clearly present

## Agentic Workflow Solution

Based on the RubyLLM agentic workflow patterns, we implemented a retry-based approach with error recovery:

### Key Components

1. **JavascriptMapper Tool** (`app/tools/javascript_mapper.rb`)
   - Executes JavaScript functions against HTML content
   - Uses the existing `JavascriptMapperCode` class with V8 engine
   - Returns structured results with success/error indicators
   - Enhanced logging for debugging and success detection

2. **Multi-Attempt Strategy** (`test/integration/experiment_with_ruby_llm_extractor_test.rb`)
   - Up to 3 attempts with different approaches
   - Progressive simplification of JavaScript generation prompts
   - Result validation and success detection
   - Graceful degradation with fallback analysis

3. **Error Recovery Patterns**
   - **Attempt 1**: Standard JavaScript generation with full features
   - **Attempt 2**: Simplified approach with basic string operations
   - **Attempt 3**: Debug mode with minimal test functions first

### Implementation Details

```ruby
# Agentic workflow with retry logic
max_attempts = 3
attempt = 1
extraction_successful = false

while attempt <= max_attempts && !extraction_successful
  puts "\nATTEMPT #{attempt}/#{max_attempts}: Trying JavaScript extraction..."
  
  if attempt == 1
    response = chat.ask 'Can you use the JavascriptMapper tool with the Javascript code you created and the HTML content that was downloaded to parse out the number of results and document data?'
  elsif attempt == 2
    response = chat.ask <<~RETRY_PROMPT
      The previous JavaScript extraction may not have worked properly. Let's try again with a simpler approach:
      
      1. First, use the JavascriptMapper tool to test your current JavaScript functions
      2. If the results show 0 documents or 0 total results, create simpler JavaScript functions that use basic string operations instead of complex regex
      3. Focus on finding obvious patterns in the HTML like repeated div classes or common HTML structures
      4. Use indexOf, substring, and split methods instead of complex regex patterns
      
      Please try the JavascriptMapper tool again with either your current functions or improved simpler ones.
    RETRY_PROMPT
  else
    response = chat.ask <<~DEBUG_PROMPT
      Let's debug why the extraction isn't working:
      
      1. Use the JavascriptMapper tool with very simple test functions first:
         - numberOfResultsMapper that just returns 5 (hardcoded)
         - docsMapper that returns a simple test array like [{id: "test", title: "Test Document"}]
      2. If that works, then gradually make the functions more sophisticated
      3. Look for the most obvious repeating pattern in the HTML (like div tags with consistent classes)
      4. Use only basic string operations: indexOf, substring, split - no regex
      
      Try the JavascriptMapper tool with either simple test functions or your best attempt at parsing.
    DEBUG_PROMPT
  end
  
  # Analyze results for success
  extraction_successful = analyze_extraction_results(response.content)
  
  unless extraction_successful
    attempt += 1
  end
end
```

### Success Detection Logic

The workflow detects successful extraction by:

1. **Tool Success Markers**: Looking for `JAVASCRIPT MAPPER TOOL COMPLETED SUCCESSFULLY` in output
2. **Result Validation**: Parsing document counts and total results from tool output
3. **Meaningful Data Check**: Ensuring non-zero results were extracted
4. **Fallback Pattern**: Checking response content for evidence of successful parsing

```ruby
def analyze_extraction_results(content)
  if content.include?('JAVASCRIPT MAPPER TOOL COMPLETED SUCCESSFULLY')
    # Parse extracted results from tool output
    doc_count = extract_number_from_content(content, 'Documents extracted:')
    total_results = extract_number_from_content(content, 'Total results counted:')
    
    # Success if we got meaningful data
    return doc_count > 0 || total_results > 0
  end
  
  # Fallback: look for evidence in response text
  if content.match(/(\d+)\s+(documents?|results?)/i) && 
     !content.match(/0\s+(documents?|results?)/i)
    return true
  end
  
  false
end
```

## Benefits

### Robustness
- **Higher Success Rate**: Multiple attempts with different strategies
- **Error Recovery**: Automatic fallback to simpler approaches
- **Graceful Degradation**: Provides useful output even on partial failures

### Debugging
- **Comprehensive Logging**: Clear indicators of tool usage and results
- **Progressive Simplification**: Each attempt uses a simpler approach
- **Validation Feedback**: Clear success/failure indicators for each attempt

### Maintainability
- **Modular Design**: Separate concerns for extraction, validation, and retry logic
- **Configurable**: Easy to adjust attempt counts and strategies
- **Observable**: Rich logging for troubleshooting and monitoring

## Usage Examples

### Test Integration

```ruby
# In test files
test 'html based search page with agentic workflow' do
  chat = RubyLLM.chat(model: 'gpt-4o-mini')
  chat.with_tools(DownloadPage, JavascriptExtractor, JavascriptMapper)
  
  # ... download HTML and generate JavaScript functions ...
  
  # Agentic workflow automatically retries on failures
  response = chat.ask 'Can you use the JavascriptMapper tool...'
  
  # Workflow includes automatic retry logic with progressive simplification
end
```

### Production Usage

The same pattern can be applied to production scenarios where JavaScript extraction needs to be robust:

```ruby
class SearchResultsExtractor
  include AgenticWorkflow
  
  def extract_from_page(url)
    with_retry(max_attempts: 3) do |attempt|
      case attempt
      when 1
        extract_with_complex_javascript(url)
      when 2  
        extract_with_simple_javascript(url)
      when 3
        extract_with_fallback_parsing(url)
      end
    end
  end
end
```

## Lessons Learned

1. **Progressive Simplification**: Starting with complex solutions and falling back to simple ones is more effective than the reverse
2. **Clear Success Criteria**: Explicit validation of results prevents false positives
3. **Rich Logging**: Detailed output is essential for debugging agentic workflows
4. **Tool Integration**: The agentic pattern works best when tools provide clear success/failure indicators

## Future Enhancements

- **Adaptive Strategies**: Learn from previous failures to choose better initial approaches
- **Parallel Attempts**: Run multiple extraction strategies concurrently
- **Context Preservation**: Share learning between attempts to improve subsequent tries
- **Metrics Collection**: Track success rates and optimization opportunities

## Related Documentation

- [RubyLLM Agentic Workflows](https://rubyllm.com/agentic-workflows/)
- [JavascriptMapper Tool](../app/tools/javascript_mapper.rb)
- [JavascriptMapperCode Library](../lib/javascript_mapper_code.rb)
- [Integration Tests](../test/integration/experiment_with_ruby_llm_extractor_test.rb)