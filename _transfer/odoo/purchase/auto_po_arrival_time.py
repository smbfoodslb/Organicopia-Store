# Purchase orders: the expected arrival always carries the time 11:59:59 PM (owner, 23 Nov 2026).
# base.automation on purchase.order, on create and whenever date_planned changes. The day is kept as the
# user sees it (his time zone, Asia/Beirut by default); only the time of day is set, on the order and on
# each of its lines (the lines are what the receipt's scheduled date follows). All companies.
zone = timezone(env.user.tz or 'Asia/Beirut')
utc = timezone('UTC')

def end_of_day(moment):
    local = moment.replace(tzinfo=utc).astimezone(zone)
    return zone.localize(datetime.datetime(local.year, local.month, local.day, 23, 59, 59)).astimezone(utc).replace(tzinfo=None)

for order in records:
    for line in order.order_line:
        if line.date_planned and line.date_planned != end_of_day(line.date_planned):
            line.write({'date_planned': end_of_day(line.date_planned)})
    if order.date_planned and order.date_planned != end_of_day(order.date_planned):
        order.write({'date_planned': end_of_day(order.date_planned)})
