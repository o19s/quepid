# frozen_string_literal: true

require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require 'open3'
require 'yaml'
require 'time'
require 'rbconfig'

class ManualTestStatusTest < Minitest::Test
  def setup
    @root = Dir.mktmpdir('manual-test-status')
    @tested_at = Time.now.utc - 3600
    FileUtils.mkdir_p(File.join(@root, 'bin'))
    FileUtils.mkdir_p(File.join(@root, 'docs/manual-testing'))
    FileUtils.cp(File.expand_path('../../bin/manual_test_status', __dir__), File.join(@root, 'bin/manual_test_status'))
    git('init', '-q')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.invalid')
  end

  def teardown
    FileUtils.remove_entry(@root)
  end

  def test_commit_after_verification_keeps_tested_edit_current
    commit_file('a.txt', @tested_at - 60, @tested_at + 60)
    assert_current status([ 'a.txt' ])
  end

  def test_checkout_timestamp_alone_does_not_require_rerun
    commit_file('a.txt', @tested_at + 60, @tested_at - 60)
    assert_current status([ 'a.txt' ])
  end

  def test_newer_edit_and_commit_require_rerun
    commit_file('a.txt', @tested_at + 60, @tested_at + 120)
    assert_due status([ 'a.txt' ])
  end

  def test_uncommitted_edit_after_verification_requires_rerun
    commit_file('a.txt', @tested_at - 120, @tested_at - 60)
    path = File.join(@root, 'a.txt')
    File.write(path, 'changed')
    File.utime(@tested_at + 60, @tested_at + 60, path)
    assert_due status([ 'a.txt' ])
  end

  def test_untracked_file_after_verification_requires_rerun
    path = File.join(@root, 'new.txt')
    File.write(path, 'new')
    File.utime(@tested_at + 60, @tested_at + 60, path)
    assert_due status([ 'new.txt' ])
  end

  def test_timestamps_are_compared_per_file
    commit_file('a.txt', @tested_at - 60, @tested_at + 60)
    commit_file('b.txt', @tested_at + 60, @tested_at - 60)
    assert_current status([ 'a.txt', 'b.txt' ])
    commit_file('c.txt', @tested_at + 60, @tested_at + 120)
    assert_due status([ 'a.txt', 'b.txt', 'c.txt' ])
  end

  def test_never_run_remains_due
    commit_file('a.txt', @tested_at - 120, @tested_at - 60)
    assert_includes status([ 'a.txt' ], nil), 'never run'
  end

  def test_expired_verification_remains_due
    expired = Time.now.utc - (92 * 86_400)
    commit_file('a.txt', expired - 120, expired - 60)
    assert_includes status([ 'a.txt' ], expired), 'stale ('
  end

  private

  def git(*, env: {})
    output, result = Open3.capture2e(env, 'git', '-C', @root, *)
    raise output unless result.success?
  end

  def commit_file name, modified_at, committed_at
    path = File.join(@root, name)
    File.write(path, name)
    File.utime(modified_at, modified_at, path)
    git('add', '--', name)
    git('commit', '-q', '-m', name, env: {
      'GIT_AUTHOR_DATE'    => committed_at.iso8601,
      'GIT_COMMITTER_DATE' => committed_at.iso8601,
    })
  end

  def status paths, last_run = @tested_at
    tracking = {
      'parts' => {
        '01' => {
          'file'      => 'scenario.md',
          'scenarios' => {
            '1.1' => {
              'title'    => 'Example',
              'last_run' => last_run,
              'result'   => 'pass',
              'paths'    => paths,
            },
          },
        },
      },
    }
    File.write(File.join(@root, 'docs/manual-testing/tracking.yml'), YAML.dump(tracking))
    output, result = Open3.capture2e(RbConfig.ruby, File.join(@root, 'bin/manual_test_status'))
    raise output unless result.success?

    output
  end

  def assert_current output
    assert_includes output, 'ok   — last run'
    assert_includes output, '0 / 1 scenarios due'
  end

  def assert_due output
    assert_includes output, 'DUE  — file changed'
    assert_includes output, '1 / 1 scenarios due'
  end
end
