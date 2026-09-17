#!/usr/bin/env bash
# Export the demo web build and rewrite it so it runs from any hosting sub-path
# (relative asset URLs, and route changes kept in the hash so the page URL stays put).
set -euo pipefail
OUT="${1:-artifact}"
EXPO_PUBLIC_DEMO=1 CI=1 npx expo export --platform web >/dev/null
rm -rf "$OUT" && cp -r dist "$OUT"
# relative asset + bundle paths
# the hosting service reserves top-level names starting with "_", so _expo -> expo
mv "$OUT/_expo" "$OUT/expo"
sed -i 's#href="/favicon.ico"#href="favicon.ico"#; s#src="/_expo/#src="expo/#' "$OUT/index.html"
sed -i 's#"/assets/#"assets/#g; s#"/_expo/#"expo/#g' "$OUT"/expo/static/js/web/*.js
# keep the page URL fixed; carry the in-app route in the hash
python3 - "$OUT/index.html" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
shim='''<script>
(function(){
  var base = location.pathname + location.search;
  function fix(u){ if (typeof u === 'string' && u.charAt(0) === '/' && u.indexOf('//') !== 0) return base + '#' + u; return u; }
  var ps = history.pushState.bind(history), rs = history.replaceState.bind(history);
  history.pushState = function(a,b,u){ return ps(a,b,fix(u)); };
  history.replaceState = function(a,b,u){ return rs(a,b,fix(u)); };
})();
</script>
'''
s=s.replace('<script src=', shim+'<script src=',1)
open(p,'w').write(s)
PY
echo "artifact build in $OUT"
