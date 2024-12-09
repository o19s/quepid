class EnqueueNightlyQueryRunnerJobs < ApplicationJob
  
  def perform book
    Case.all.nightly_run.each do |kase|
      try = kase.tries.last
      QueryRunnerJob.perform_later kase, try
    end
  end
end
