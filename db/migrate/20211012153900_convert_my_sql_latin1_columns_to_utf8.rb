class ConvertMySqlLatin1ColumnsToUtf8 < ActiveRecord::Migration[6.1]
  def change

    # no text in these tables
    # case_metadata
    # case_scores
    # snapshot_queries
    # teams_cases
    # teams_members

    # has a string or text

    execute("set names utf8")

    # change this hash for your application. This example here is for a
    # totally original blog application concept.
    keys = {
        :curator_variables   => %w{name},
        :ratings => %w{doc_id},
        :snapshot_docs => %w{doc_id `explain`},
        :snapshots => %w{name},
        :teams => %w{name}
    }

    conversions = {
      'C383C2A1'         => 'á', 'C383C2A0'       => 'à', 'C383C2A4'       => 'ä', 'C383C2A2'   => 'â',
      'C383C2A9'         => 'é', 'C383C2A8'       => 'è', 'C383C2AB'       => 'ë', 'C383C2AA'   => 'ê',
      'C383C2AD'         => 'í', 'C383C2AC'       => 'ì', 'C383C2AF'       => 'ï', 'C383C2AE'   => 'î',
      'C383C2B3'         => 'ó', 'C383C2B2'       => 'ò', 'C383C2B6'       => 'ö', 'C383C2B4'   => 'ô',
      'C383C2BA'         => 'ú', 'C383C2B9'       => 'ù', 'C383C2BC'       => 'ü', 'C383C2BB'   => 'û',
      'C383C281'         => 'Á', 'C383E282AC'     => 'À', 'C383E2809E'     => 'Ä', 'C383E2809A' => 'Â',
      'C383E280B0'       => 'É', 'C383CB86'       => 'È', 'C383E280B9'     => 'Ë', 'C383C5A0'   => 'Ê',
      'C383C28D'         => 'Í', 'C383C592'       => 'Ì', 'C383C28F'       => 'Ï', 'C383C5BD'   => 'Î',
      'C383E2809C'       => 'Ó', 'C383E28099'     => 'Ò', 'C383E28093'     => 'Ö', 'C383E2809D' => 'Ô',
      'C383C5A1'         => 'Ú', 'C383E284A2'     => 'Ù', 'C383C593'       => 'Ü', 'C383E280BA' => 'Û',
      'C385C2B8'         => 'Ÿ', 'C385E2809C'     => 'œ', 'C383C2B8'       => 'ø', 'C383C2BF'   => 'ÿ',
      'C3A2E282ACC593'   => '“', 'C3A2E282ACC29D' => '”', 'C3A2E282ACCB9C' => '‘',
      'C3A2E282ACE284A2' => '’', 'C382C2AB'       => '«', 'C382C2BB'       => '»',
      'C383C2A5'         => 'å', 'C383E280A6'     => 'Å', 'C383C5B8'       => 'ß', 'C383E280A0' => 'Æ',
      'C383C2A7'         => 'ç', 'C383E280A1'     => 'Ç', 'C383C2B1'       => 'ñ', 'C383E28098' => 'Ñ',
      'C383C2A3'         => 'ã', 'C383C2B5'       => 'õ', 'C383C692'       => 'Ã', 'C383E280A2' => 'Õ'
    }

    keys.each { |table, columns|
      execute "alter table #{table} convert to character set utf8"
      columns.each { |column|
        conversions.each { |hex, utf8|
          execute("update #{table} set #{column} = replace(#{column}, unhex('#{hex}'), '#{utf8}') where cast(#{column} as binary) regexp binary unhex('#{hex}');")
        }
      }
    }
  end
end
