DOT='\033[0;37m.\033[0m'
ERROR='\033[0;31m[QUICKSTART] '
RESET='\033[0m' # No Color

ping -c 1 keycloak &> /dev/null
if [[ $? -ne 0 ]]; then
  echo -e "${ERROR}To make Keycloak work, you need to add the following line to your hosts file (/etc/hosts on Mac/Linux, c:\Windows\System32\Drivers\etc\hosts on Windows).${RESET}"
  echo -e "${ERROR}127.0.0.1	keycloak${RESET}"
  echo -e "${ERROR}This is because you will access your application with a browser on your machine (which name is localhost, or 127.0.0.1), but inside Docker it will run in its own container, which is named keycloak.${RESET}"
fi

while [[ "$(curl -s 'http://keycloak:9080/auth/realms/quepid' | jq '.realm')" != '"quepid"' ]]; do printf ${DOT}; sleep 5; done
echo ""
