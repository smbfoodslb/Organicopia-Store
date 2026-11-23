# base.automation on res.partner, when "Delivers with" (x_delivers_with) changes (owner, 23 Nov 2026).
# Keeps the link visible from both cards: A delivers with B -> B delivers with A when B has none.
# Clearing it on A clears it on the cards that pointed to A. The planner reads the link in both
# directions anyway; this is only so the owner sees it on either contact. Touches nothing else.
for partner in records:
    other = partner.x_delivers_with
    if other:
        if other.id == partner.id:
            partner.write({'x_delivers_with': False})
        elif not other.x_delivers_with:
            other.write({'x_delivers_with': partner.id})
    else:
        back = env['res.partner'].search([('x_delivers_with', '=', partner.id)])
        if back:
            back.write({'x_delivers_with': False})
