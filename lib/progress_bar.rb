# frozen_string_literal: true

# Usage:
#
# bar = ProgressBar.new
# bar.print(50, 100)
#
# => [==============================                              ] 50%
#
#
# ProgressBar.progress_loop(objects.length) do |bar, total|
#   objects.each.with_index do |object, index|
#     bar.print(index + 1, total)
#
#     ... your code here
#   end
# end
#
# => [==============================                              ] 50%
#
class ProgressBar
  def initialize units = 60
    @units = units.to_f
  end

  def print completed, total
    norm     = 1.0 / (total / @units)
    progress = (completed * norm).floor
    pending  = @units - progress
    Kernel.print "[#{'=' * progress}#{' ' * pending}] #{percentage(completed, total)}%\r"
  end

  def percentage completed, total
    ( ( completed / total.to_f ) * 100 ).round
  end

  def finish
    puts '' # Avoid printing anything on top of the progress bar.
  end

  # Surrounds the block with the setup and finish calls necessary for
  # the Progress Bar to do its job, without the need for repetition.
  def self.progress_loop total, length = 100, &block
    bar     = ProgressBar.new length
    result  = block.call(bar, total)
    bar.finish
    result
  end
end
