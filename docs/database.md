# Database

## Backup a Database

Install MysqlDB to get the mysqldump tool ;-) and then use a full path like `/usr/local/mysql/bin/`.

```
mysqldump -h OLDHOST -u OLDUSER -pOLDPASS OLDDATABASE  --column-statistics=0 --set-gtid-purged=OFF | zip > quepid_backup_`date +"%Y_%m_%d"`.sql.zip
```

## Restore a Database

Assuming you have used mysqldump to get a dump, you can restore to dev via:

```
/usr/local/mysql/bin/mysql --verbose --host=127.0.0.1 --port=3306 -u root -p quepid_development < quepid_prod_2021_03_02.sql
```

Or if you have a Zip file:

```
unzip -p quepid_prod_2021_03_02.sql.zip | /usr/local/mysql/bin/mysql --host=127.0.0.1 --port=3306 -u root -p quepid_development
```

## DigitalOcean Notes

DigitalOcean has the setting `sql_require_primary_key` set to true, which conflicts with ActiveRecords `schema_migrations` table.
To get around this, you need to use the API to make it false when loading the data. 

https://www.digitalocean.com/community/questions/how-do-i-disable-the-require-primary-key-when-creating-a-table

```
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $YOUR_DO_PERSONAL_ACCESS_TOKEN" \
  -d '{"config": {"sql_require_primary_key": false}}' \
  "https://api.digitalocean.com/v2/databases/$YOUR_DB_ID_HERE/config"
```

## Emoji Support

Both the `scorers` and `queries` tables have columns that support using emojis.   To do this, they need
a different set of options when creating the tables:

```
CHARSET=utf8mb4 COLLATE=utf8mb4_bin
```

If your migration add/drops a table, you may need to edit `schema.rb` to restore that definition.  Your tests
will fail fortunately ;-).  Expect to see `ERROR emoji support#test_handles_emoji_in_code (27.86s)`
