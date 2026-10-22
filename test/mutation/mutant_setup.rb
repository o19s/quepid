# frozen_string_literal: true

# Mutant's Ruby entry point (config/mutant.yml `requires`).

# The Minitest integration replaces Minitest.autorun with a no-op, but only once it's loaded,
# which Mutant does after `requires`. Load it first, or test_helper registers autorun and the
# whole suite runs again when Mutant exits.
require 'mutant/integration/minitest'
require 'test_helper'

# Mutant finds subjects among loaded constants, and the test environment autoloads lazily.
Rails.application.eager_load!

# Mutant reads every loaded Module's `name` and only rescues StandardError. easy_talk_two's
# EasyTalk::Types::Composer.name raises NotImplementedError (a ScriptError), which would
# abort the run, so skip that scope the same way Mutant skips the ones it does rescue.
Mutant::Bootstrap.singleton_class.prepend(
  Module.new do
    private

    def scope_name reporter, raw_scope
      super
    rescue NotImplementedError
      nil
    end
  end
)
