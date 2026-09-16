-- Synor's migration driver (mysql@2) only supports mysql_native_password.
-- Runs once when the data volume is first initialised.
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'root';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';
FLUSH PRIVILEGES;
