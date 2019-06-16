# frozen_string_literal: true

require 'colorize'
require 'progress_bar'

module ProgressIndicator
  private

  def print_step text
    logger.info text.yellow if show_progress?

    self
  end

  def block_with_progress_bar number, &block
    if show_progress?
      ProgressBar.progress_loop(number) do |bar, total|
        number.times do |i|
          bar.print(i + 1, total)
          block.call(i)
        end
      end
    else
      number.times do |i|
        block.call(i)
      end
    end

    self
  end
end
