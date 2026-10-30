#!/bin/sh
set -e

# Render tells the app which port to use.
PORT="${PORT:-10000}"
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# The database address comes from the host. A PostgreSQL address always means the pgsql connection.
case "$DB_URL" in
  postgres*) export DB_CONNECTION=pgsql ;;
  "")
    echo "DB_URL is empty. Add the database's Internal Database URL in the service's Environment settings."
    exit 1
    ;;
esac

php artisan package:discover --ansi
php artisan migrate --force
php artisan raincheck:install-data

exec apache2-foreground
