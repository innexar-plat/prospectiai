import { rateLimit } from "../lib/ratelimit"

// Mock Redis
jest.mock("ioredis", () => {
    return jest.fn().mockImplementation(() => {
        const store: Record<string, string> = {}
        return {
            get: jest.fn().mockImplementation((key) => Promise.resolve(store[key] || null)),
            set: jest.fn().mockImplementation((key, val) => {
                store[key] = val
                return Promise.resolve("OK")
            }),
            incr: jest.fn().mockImplementation((key) => {
                const val = parseInt(store[key] || "0") + 1
                store[key] = val.toString()
                return Promise.resolve(val)
            }),
            expire: jest.fn().mockResolvedValue(1),
            ttl: jest.fn().mockResolvedValue(60),
            multi: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
            on: jest.fn(),
            connect: jest.fn().mockResolvedValue(undefined)
        }
    })
})

describe("Rate Limiting Utility", () => {
    it("should allow requests within the limit", async () => {
        const { success, remaining } = await rateLimit("test-ip", 5, 60)
        expect(success).toBe(true)
        expect(remaining).toBe(4)
    })

    it("should block requests exceeding the limit", async () => {
        // First 5 requests
        for (let i = 0; i < 5; i++) {
            await rateLimit("block-ip", 5, 60)
        }

        const { success, remaining } = await rateLimit("block-ip", 5, 60)
        expect(success).toBe(false)
        expect(remaining).toBe(0)
    })
})
