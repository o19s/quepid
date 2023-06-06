module HomeHelper
  
  def greeting
    greetings = [
      "Good Day",
      "Hello",
      "How's your day",
      "Good to see you",
      "Hiya!",
      "Bonjour"
    ]
    greetings.sample
  end
  def greeting2
    current_time = DateTime.current.seconds_since_midnight
    midnight = DateTime.now.beginning_of_day.seconds_since_midnight
    noon = DateTime.now.middle_of_day.seconds_since_midnight
    five_pm = DateTime.now.change(:hour => 17 ).seconds_since_midnight
    eight_pm = DateTime.now.change(:hour => 20 ).seconds_since_midnight
    
    puts "DateTime.current #{DateTime.current}"
    puts "midnight: #{midnight}"
    puts "noon: #{noon}"
    puts "current_time: #{current_time}"
     
    case 
      when midnight.upto(noon).include?(current_time)
      greeting = "Good Morning"
      when noon.upto(five_pm).include?(current_time)
      greeting = "Good Afternoon"
      when five_pm.upto(eight_pm).include?(current_time)
      greeting = "Good Evening"
      when eight_pm.upto(midnight + 1.day).include?(current_time)
      greeting = "Good Night"
    end
    return greeting
  end
end
