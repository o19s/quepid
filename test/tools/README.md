# Tool Tests

This directory contains comprehensive tests for the RubyLLM tools located in `app/tools/`.

## Test Organization

Each tool has its own dedicated test file:

- `download_page_test.rb` - Tests for the `DownloadPage` tool
- `java_script_extractor_test.rb` - Tests for the `JavaScriptExtractor` tool

## Running Tests

Run all tool tests:
```bash
bin/docker r bundle exec rails test test/tools/
```

Run tests for a specific tool:
```bash
bin/docker r bundle exec rails test test/tools/download_page_test.rb
bin/docker r bundle exec rails test test/tools/java_script_extractor_test.rb
```

Run with verbose output:
```bash
bin/docker r bundle exec rails test test/tools/ -v
```

## Test Coverage

### DownloadPage Tests (13 tests)
- URL validation (format, nil, empty)
- HTTP response handling (success, errors, empty content)
- Network error handling (timeouts, connection failures)
- HTML cleaning functionality
- Exception handling

### JavaScriptExtractor Tests (16 tests)
- Markdown parsing with labeled blocks (`javascript`, `js`)
- Case-insensitive block detection
- Unlabeled block detection with heuristics
- Input validation (types, empty content)
- JavaScript syntax validation (balanced braces, brackets, parentheses)
- Error handling for malformed content
- Integration with fixture files

## Testing Patterns

### WebMock for HTTP Testing
The `DownloadPage` tests use WebMock to stub HTTP requests:

```ruby
stub_request(:get, "https://example.com")
  .to_return(status: 200, body: '<html>...</html>')
```

### Comprehensive Input Validation
Tests verify tools handle various input scenarios:
- Valid inputs
- Invalid inputs (nil, wrong type, empty)
- Edge cases (malformed data, network errors)

### Error Handling Verification
Tests ensure tools return proper error structures:
```ruby
assert result.is_a?(Hash), "Should return error hash"
assert result.key?(:error), "Should have error key"
```

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on external services
2. **Coverage**: Tests cover both happy path and error scenarios  
3. **Clarity**: Test names clearly describe what is being tested
4. **Assertions**: Multiple assertions verify different aspects of the behavior
5. **Setup**: Use `setup` method to initialize common test objects

## Adding New Tool Tests

When adding a new tool:

1. Create a new test file: `test/tools/my_tool_test.rb`
2. Follow the naming convention: `MyToolTest`
3. Include comprehensive test coverage:
   - Basic functionality tests
   - Input validation tests
   - Error handling tests
   - Edge case tests
4. Use WebMock for any external HTTP requests
5. Update this README with the new test information