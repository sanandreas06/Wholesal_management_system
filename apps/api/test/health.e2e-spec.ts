import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
describe("Health",()=>{let app:INestApplication;
beforeAll(async()=>{const m=await Test.createTestingModule({imports:[AppModule]}).compile();app=m.createNestApplication();app.setGlobalPrefix("api");await app.init();});
afterAll(()=>app.close());
it("GET /api/health",async()=>{const r=await request(app.getHttpServer()).get("/api/health");expect(r.status).toBe(200);expect(r.body.status).toBe("ok");});});
