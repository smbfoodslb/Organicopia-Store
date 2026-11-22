# base.automation on res.partner (on create / when x_map_link changes).
# Reads coordinates out of the pasted "Map location" and stores them in
# partner_latitude / partner_longitude. Accepts "33.87, 35.55" or any Google
# Maps link that carries the coordinates (!3d..!4d.., q=, ll=, query=,
# destination=, @lat,lng) or degrees-minutes-seconds as Google Maps shows them
# (33°52'01.3"N 35°30'45.8"E). Short links (maps.app.goo.gl) carry no coordinates:
# they are left for the delivery planner, where the pin is placed once.
def lead_number(text):
    out = ''
    for ch in text.strip():
        if ch in '0123456789.-':
            out += ch
        else:
            break
    try:
        return float(out) if '.' in out else None
    except Exception:
        return None

def pair(a, b):
    lat = lead_number(a)
    lng = lead_number(b)
    if lat is None or lng is None:
        return None
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return (lat, lng)
    return None

def dms(text):
    t = text.upper()
    for ch in ['\u00b0', '\u00ba', "'", '"', '\u2032', '\u2033', '\u2019', '\u201d', ',']:
        t = t.replace(ch, ' ')
    for h in ['N', 'S', 'E', 'W']:
        t = t.replace(h, ' ' + h + ' ')
    vals = []
    cur = []
    for bit in t.split():
        if bit in ('N', 'S', 'E', 'W'):
            if not cur or len(cur) > 3:
                return None
            v = cur[0] + (cur[1] / 60.0 if len(cur) > 1 else 0) + (cur[2] / 3600.0 if len(cur) > 2 else 0)
            vals.append((bit, -v if bit in ('S', 'W') else v))
            cur = []
        else:
            try:
                cur.append(float(bit))
            except Exception:
                return None
    if cur or len(vals) != 2 or vals[0][0] not in ('N', 'S') or vals[1][0] not in ('E', 'W'):
        return None
    lat = round(vals[0][1], 7)
    lng = round(vals[1][1], 7)
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return (lat, lng)
    return None

def parse(link):
    if '\u00b0' in link and 'http' not in link:
        return dms(link)
    s = link.replace('%2C', ',').replace('%2c', ',').replace('+', ' ')
    if '!3d' in s and '!4d' in s:
        got = pair(s.split('!3d')[-1], s.split('!4d')[-1])
        if got:
            return got
    for key in ['q=', 'll=', 'query=', 'destination=', 'daddr=', 'center=']:
        if key in s:
            part = s.split(key)[1].split('&')[0].replace('loc:', '')
            if ',' in part:
                got = pair(part.split(',')[0], part.split(',')[1])
                if got:
                    return got
    if '@' in s:
        part = s.split('@')[1]
        if ',' in part:
            got = pair(part.split(',')[0], part.split(',')[1])
            if got:
                return got
    if 'http' not in s:
        bits = [b for b in s.replace(';', ',').replace(',', ' ').split(' ') if b]
        if len(bits) == 2:
            return pair(bits[0], bits[1])
    return None

for partner in records:
    link = (partner.x_map_link or '').strip()
    if not link:
        continue
    found = parse(link)
    if found and (abs(partner.partner_latitude - found[0]) > 0.0000001 or abs(partner.partner_longitude - found[1]) > 0.0000001):
        partner.write({'partner_latitude': found[0], 'partner_longitude': found[1]})
