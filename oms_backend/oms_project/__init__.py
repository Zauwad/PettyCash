import pymysql

# Patch MySQLdb to use PyMySQL for database operations, avoiding native compilation issues
pymysql.install_as_MySQLdb()
