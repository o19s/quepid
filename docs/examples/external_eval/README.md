# Integrating Quepid into External Evaluation Tools

## Store and Visualize Scores via Quepid 

This demonstrates how to store query evalution results in Quepid as a repository, and leverage the existing visualization capablities.   

Quepid would NOT do the running of the queries, or even store the individual queries and the judgements.  The script generates the Case at run time if it doesn't already exist.  Over time you build up a Case for a specific Scorer that has a set of Scores over time.

You need to have a Personal Access Token created in the target Quepid, you do this from the "My Profile" page.

When you create it, you will get an example call you can use to test your setup:

```
curl -H "Authorization: Bearer 0d078b465f73c8f5f34dd57c50e317053b4bd69b22f0f6a25479c00775f47589" http://app.quepid.com/api/users/3
```

The docs below reference access token, replace with you own.  

setup your tokens via:

```
export QUEPID_TOKEN=0d078b465f73c8f317053b4bd69b22f0f6a25479c00775f47589
```


### To Store a Score from an Evaluation Run

The script assumes you have a Team set up that you want the Case to be shared with, as well as a Scorer.  It will error out if neither of those exist.  

The Case is created if it doesn't exist when the script is run.

```
python3 store_score_for_case.py --root_url=https://app.quepid.com --access_token=${QUEPID_TOKEN} --case_name=NIGHTLY_CASE --team_name=MyTeam --scorer_name=nDCG@10 --score=.78
```

Then don't forget to add folks who want to see the scores to the Team!

Now, go visit the Case detail page, you will see there are NO queries in Quepid.  Go to the home page to see the scores plotted out.  You need three days of data before you get a visualization.
