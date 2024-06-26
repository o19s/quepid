import requests
import json
import argparse

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--access_token',
                        type=str)    
    parser.add_argument('--root_url',
                        type=str)
    
    parser.add_argument('--case_name',
                        type=str)      
    parser.add_argument('--team_name',
                        type=str)
    parser.add_argument('--scorer_name',
                        type=str)
    
    parser.add_argument('--score',
                        type=str)  

  
    return vars(parser.parse_args())
    
def same(x,y):
  return x.casefold() == y.casefold()
  
args = parse_args()
root_url = args['root_url']
access_token = args['access_token']    
case_name = args['case_name']
score = args['score']
team_name = args['team_name']
scorer_name = args['scorer_name']

case = None
team = None
scorer = None
atry = None

headers = {
  'Authorization': f'Bearer {access_token}',
  'Accept' : 'application/json', 
  'Content-Type' : 'application/json'  
}

# Get the team, or raise an error if it can't be found.
url = f'{root_url}/api/teams/'
r = requests.get(url, headers=headers)
response = r.json()
for x in response['teams']:
  if same(x['name'],team_name):
    team = x
    
if team is None:
  raise Exception(f"Sorry, we did not find a team {team_name} associated with the user.") 

# Get the scorer, or raise an error if it can't be found.
url = f'{root_url}/api/scorers/'
r = requests.get(url, headers=headers)
response = r.json()
for x in response['user_scorers']:
  if same(x['name'],scorer_name):
    scorer = x
for x in response['communal_scorers']:
  if same(x['name'],scorer_name):
    scorer = x    
    
if scorer is None:
  raise Exception(f"Sorry, we did not find a scorer {scorer_name} associated with the user.") 
  
# Now look up the case
url = f'{root_url}/api/cases/'
r = requests.get(url, headers=headers)

response = r.json()

for x in response['all_cases']:
  if same(x['case_name'],case_name):
    case = x
    
print(f'Do we need to create a case? {case is None}')

if case is None:
  payload = {
    "case_name": case_name,
    "team_id": team['id'],
    "scorer_id": scorer['scorer_id'],
    
  }
  url = f'{root_url}/api/cases/'
  r = requests.post(url, data=json.dumps(payload), headers=headers)
  
  response = r.json()
  #print(json.dumps(response, indent=4))
  
  case = response
  
  # Now associate with the team
  payload = {
    "id": case['case_id']      
  }
  url = f'{root_url}/api/teams/{team['id']}/cases'
  
  r = requests.post(url, data=json.dumps(payload), headers=headers)
  
  
 # Ensure we have a try created and if not, create one 
url = f'{root_url}/api/cases/{case['case_id']}/tries'
 
r = requests.get(url, headers=headers)
response = r.json()
atry = response['tries'][0]
  
  

print(f'Working with case {case['case_name']}')

# Finally able to associate a score.
# 
#  {:user_id=>3, "score"=>0, "all_rated"=>false, "try_number"=>1, "queries"=>{"23"=>{"text"=>"milk", "score"=>0, "maxScore"=>1, "numFound"=>8516}}}
print(f'About to store score for {url}')
payload = {
  "case_score": {
    "score": score,
    "all_rated": False, 
    "try_number": atry["try_number"]
  }      
}

url = f'{root_url}/api/cases/{case['case_id']}/scores'
r = requests.put(url, data=json.dumps(payload), headers=headers)
response = r.json()
print(json.dumps(response, indent=4))
