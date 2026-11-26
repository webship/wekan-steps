#!/usr/bin/env bash
# Build the test site of this pack in a DDEV project: Wekan's own image on the project's own MongoDB 7 (a replica set
# of one, as Wekan's reference setup runs it), an administrator of this site as Wekan's first account (its password
# made for this site, kept in the site's folder for the counts and the tidy, never printed), the accounts of the suite in
# their roles of the board Webship site, and the sample content the features read (three cards in the board's lists, a
# label, an assignee, a comment, a checklist, Scrum planning with Sprint 1 active, half an hour of logged time). It is
# what CI runs; on a machine with Docker, DDEV and 1.5 GB of free memory it makes the same site.
#
#   SITE_DIR=<folder>        where the project goes (default: ../wekan-site beside the pack)
#   RELEASE=<X.Y>            the release of Wekan's image (default: 13.33; the image is tagged v<release>)
#   COUNTS_ONLY=1            build nothing: print what the site holds, one count a line (a run must leave them)
#   TIDY_ONLY=1              build nothing: remove the cards and comments a stopped run left ("Webship test …" of the
#                            suite's accounts in Webship site)
#
# The site answers at https://wekansteps.ddev.site, the address cucumber.js opens by default. The site script
# (site/wekan-site.mjs) and the services (site/docker-compose.wekan.yaml) are the ones of the Webship Workspace's Wekan
# plugin: the script runs in the project's web container against Wekan's REST API, and what it reads (the accounts,
# their passwords) comes on its input.
set -euo pipefail

PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-${PACK}/../wekan-site}"
NAME=wekansteps
RELEASE="${RELEASE:-13.33}"
IMAGE="ghcr.io/wekan/wekan:v${RELEASE}"
MONGO_IMAGE='docker.io/library/mongo:7.0.48'
PASSWORD='dD.123123ddd'

# The payload of the site script, on its input: the site's administrator (its password from the site's folder) and the
# accounts of the suite; a first argument is another password for the member.
payload() {
  python3 - "${SITE_DIR}/wekan/admin" "${PASSWORD}" "${1:-}" <<'PYEOF'
import base64, json, sys
admin = open(sys.argv[1]).read().strip()
password = sys.argv[2]
member = sys.argv[3] or password
rows = [{'login': login, 'mail': login + '@example.com', 'password': member if login == 'member' else password, 'name': login.capitalize() + ' Test', 'role': role, 'action': ''}
        for login, role in [('owner', 'owner'), ('member', 'member'), ('reader', 'reader'), ('stranger', '')]]
print(base64.b64encode(json.dumps({'admin': {'login': 'webmaster', 'password': admin}, 'rows': rows, 'login': ''}).encode()).decode())
PYEOF
}

# The site script, in the project's web container; its input reaches it.
site() {
  ( cd "${SITE_DIR}" && ddev exec "cd /var/www/html && node wekan/wekan-site.mjs $*" )
}

# A verb of the site script that builds the site: what the script makes through Wekan's own methods (the full names, a
# password given back, Scrum planning with Sprint 1, the logged time) depends on the pinned release, and a part it could
# not make (a line starting "WARNING:") fails the build here, so a new pin shows a break at once.
build() {
  local out ;
  out="$(site "$@")" || { printf '%s\n' "${out}" ; exit 1 ; } ;
  printf '%s\n' "${out}" ;
  if printf '%s\n' "${out}" | grep -q '^WARNING:' ; then
    echo "The site script could not make a part of the site through Wekan's own methods on Wekan ${RELEASE} (above)." ;
    exit 1 ;
  fi
}

if [ "${COUNTS_ONLY:-}" = 1 ] ; then
  payload | site counts | grep -E '^[a-z ]+ [0-9.]+( \(archived [0-9]+\))?$'
  exit 0
fi
if [ "${TIDY_ONLY:-}" = 1 ] ; then
  payload | site tidy
  exit 0
fi

secret() { head -c 200 /dev/urandom | base64 -w0 | tr -dc 'A-Za-z0-9' | head -c "$1" ; }

mkdir -p "${SITE_DIR}/wekan" "${SITE_DIR}/.ddev"
SITE_DIR="$(cd "${SITE_DIR}" && pwd)"
cd "${SITE_DIR}"
# No MariaDB: Wekan needs a MongoDB-compatible database, so the project runs MongoDB 7 as its own service.
ddev config --project-type=generic --project-name="${NAME}" --omit-containers=db --nodejs-version=24 < /dev/null

cp "${PACK}/site/wekan-site.mjs" wekan/
cp "${PACK}/site/docker-compose.wekan.yaml" .ddev/
( umask 077
  cat > wekan/env <<ENVEOF
WEKAN_RELEASE=${RELEASE}
MONGO_URL=mongodb://mongo:27017/wekan?replicaSet=rs0
MONGO_OPLOG_URL=mongodb://mongo:27017/local?replicaSet=rs0
METEOR_REACTIVITY_ORDER=changeStreams,oplog,polling
ROOT_URL=https://${NAME}.ddev.site
PORT=8080
WITH_API=true
WRITABLE_PATH=/data
MAIL_URL=smtp://web:1025/?ignoreTLS=true
MAIL_FROM=Wekan <wekan@example.com>
BROWSER_POLICY_ENABLED=true
CARDS_LOADING=all
BIGEVENTS_PATTERN=NONE
ENVEOF
  [ -s wekan/admin ] || printf 'Aa1.%s\n' "$(secret 20)" > wekan/admin
)
printf 'WEKAN_IMAGE=%s\nWEKAN_MONGO_IMAGE=%s\n' "${IMAGE}" "${MONGO_IMAGE}" > .ddev/.env

echo "Starting MongoDB 7 and Wekan ${RELEASE}."
ddev start -y < /dev/null
code=''
for attempt in $(seq 1 100) ; do
  code="$(ddev exec "curl -s -o /dev/null -m 15 -w '%{http_code}' http://wekan:8080/sign-in" < /dev/null 2>/dev/null | tr -d '\r' | tail -1 || true)"
  [ "${code}" = 200 ] && break
  [ "${attempt}" = 100 ] && { echo "Wekan did not answer (${code:-none})." ; ddev logs -s wekan --tail 80 < /dev/null || true ; ddev logs -s mongo --tail 20 < /dev/null || true ; exit 1 ; }
  sleep 3
done

# The site's administrator as Wekan's first account (its password made for this site, never printed); then the
# accounts of the suite and the sample content: the board Webship site, administered by owner, with member (a normal
# member) and reader (a read-only member); stranger not on it. Each part the site script makes through Wekan's own
# methods is checked here, or by the features that read it.
python3 - "${SITE_DIR}/wekan/admin" <<'PYEOF' | build install
import base64, json, sys
print(base64.b64encode(json.dumps({'login': 'webmaster', 'mail': 'webmaster@example.com', 'password': open(sys.argv[1]).read().strip(), 'name': 'Webmaster Workspace'}).encode()).decode())
PYEOF
payload | build accounts
# A password given back, by Wekan's own method: the member's is set to another one, then the accounts are made again.
payload "Aa1.$(secret 16)" | build accounts > /dev/null
given="$(payload | build accounts)"
printf '%s\n' "${given}" | grep -q '^  member: its password given back' || { printf '%s\n' "${given}" ; echo "The member's password was not given back." ; exit 1 ; }
echo "The member's password was given back."
payload | build content

echo "The site: https://${NAME}.ddev.site (Wekan ${RELEASE} on MongoDB 7)"
[ -n "${GITHUB_ENV:-}" ] && echo "LAUNCH_URL=https://${NAME}.ddev.site" >> "${GITHUB_ENV}"
exit 0
