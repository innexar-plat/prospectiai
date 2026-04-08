const { PATCH } = require("@/app/api/leads/[id]/route");
const { auth } = require("@/auth");
const { prisma } = require("@/lib/prisma");
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    leadAnalysis: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pipelineBrief: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));
jest.mock("@/lib/lead-intelligence", () => ({ recordLeadEvent: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

describe("PATCH /api/leads/[id]", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it("returns 401 when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    const req = new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CONTACTED" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "la1" }) });
    expect(res.status).toBe(401);
  });
  it("returns 404 when lead not found", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, expires: "" });
    prisma.leadAnalysis.findUnique.mockResolvedValue(null);
    const req = new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CONTACTED" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "la1" }) });
    expect(res.status).toBe(404);
  });
  it("returns 200 when update succeeds", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, expires: "" });
    prisma.leadAnalysis.findUnique.mockResolvedValue({ id: "la1", status: "NEW", leadId: "lead1", workspaceId: "w1" });
    prisma.leadAnalysis.update.mockResolvedValue({ id: "la1", status: "CONTACTED" });
    const req = new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CONTACTED" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "la1" }) });
    expect(res.status).toBe(200);
  });
});
