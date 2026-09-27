import { describe, expect, it, vi } from 'vitest';

import { QuoteRoutingService } from './quote-routing.service';

function tx(agents: Array<{ id: string; maxOpenLeads: number; open: number }>, already: string[] = []) {
  return {
    quoteRequestAgent: {
      findMany: vi.fn().mockResolvedValue(already.map((agentId) => ({ agentId }))),
      createMany: vi.fn()
    },
    agent: {
      findMany: vi.fn().mockResolvedValue(agents.map((agent) => ({ ...agent, _count: { routings: agent.open } }))),
      updateMany: vi.fn()
    },
    quoteRequest: { updateMany: vi.fn() }
  };
}

describe('QuoteRoutingService', () => {
  const service = new QuoteRoutingService();

  it('picks at most three agencies under their lead limit, in rotation order', async () => {
    const client = tx([
      { id: 'a', maxOpenLeads: 5, open: 1 },
      { id: 'full', maxOpenLeads: 2, open: 2 },
      { id: 'b', maxOpenLeads: 5, open: 0 },
      { id: 'c', maxOpenLeads: 5, open: 4 },
      { id: 'd', maxOpenLeads: 5, open: 0 }
    ]);

    const chosen = await service.route(client as never, 'req-1', ['Uttarakhand']);

    expect(chosen).toEqual(['a', 'b', 'c']);
    expect(client.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: [{ serviceStates: { isEmpty: true } }, { serviceStates: { hasSome: ['Uttarakhand'] } }]
        })
      })
    );
    expect(client.quoteRequest.updateMany).toHaveBeenCalledWith({ where: { id: 'req-1', status: 'NEW' }, data: { status: 'ROUTED' } });
  });

  it('only tops up to three when some agencies already have the request', async () => {
    const client = tx([{ id: 'b', maxOpenLeads: 5, open: 0 }, { id: 'c', maxOpenLeads: 5, open: 0 }], ['a', 'z']);

    expect(await service.route(client as never, 'req-1', [])).toEqual(['b']);
  });

  it('leaves the request unrouted when nobody is available', async () => {
    const client = tx([{ id: 'full', maxOpenLeads: 1, open: 1 }]);

    expect(await service.route(client as never, 'req-1', ['Goa'])).toEqual([]);
    expect(client.quoteRequest.updateMany).not.toHaveBeenCalled();
  });
});
