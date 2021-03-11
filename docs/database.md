# Database


## Restore a Database

Assuming you have used mysqldump to get a dump, you can restore to dev via:

```
mysql --host=127.0.0.1 --port=3306 -u root -p quepid_development < quepid_prod_2021_03_02.sql
```
