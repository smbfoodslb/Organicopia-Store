# Purchase orders: the expected arrival always carries the time 11:59:59 PM (owner, 23 Nov 2026).
# base.automation on purchase.order, on create and whenever date_planned changes. The day is kept as the
# user sees it (his time zone, Asia/Beirut by default); only the time of day is set. All companies.
zone = timezone(env.user.tz or 'Asia/Beirut')
utc = timezone('UTC')
for order in records:
    if not order.date_planned:
        continue
    local = order.date_planned.replace(tzinfo=utc).astimezone(zone)
    target = zone.localize(datetime.datetime(local.year, local.month, local.day, 23, 59, 59)).astimezone(utc).replace(tzinfo=None)
    if order.date_planned != target:
        order.write({'date_planned': target})
