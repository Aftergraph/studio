const target = new URL('/billing/', location.origin);
target.search = location.search;
target.hash = location.hash;
location.replace(target);
