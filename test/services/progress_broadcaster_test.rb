# frozen_string_literal: true

require 'test_helper'

class ProgressBroadcasterTest < ActiveSupport::TestCase
  test 'progress is throttled and delivered only to authorized users' do
    book = books(:james_bond_movies)
    calls = []
    original = Turbo::StreamsChannel.method(:broadcast_render_to)
    Turbo::StreamsChannel.define_singleton_method(:broadcast_render_to) { |*args, **kwargs| calls << [ args, kwargs ] }
    progress = ProgressBroadcaster.new(book, 1000)
    progress.advance(999, nil)
    assert_empty calls
    progress.advance(990, nil)
    expected = [ book.owner_id, *book.teams.joins(:members).pluck('teams_members.member_id') ].compact.uniq.sort
    assert_equal expected, calls.map { |args, _kwargs| args.first.id }.sort
    assert(calls.all? { |args, kwargs| :notifications == args.second && 1 == kwargs[:locals][:percent] })
    count = calls.size
    progress.advance(989, nil)
    assert_equal count, calls.size
  ensure
    Turbo::StreamsChannel.define_singleton_method(:broadcast_render_to, &original) if original
  end
end
