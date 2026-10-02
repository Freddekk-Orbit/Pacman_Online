import { inviteUrl, parseJoinCode, publicOrigin } from "../src/server/publicUrl.ts";

describe("public worldwide URLs", () => {
  it("prefers PUBLIC_URL over request host", () => {
    expect(
      publicOrigin({
        publicUrl: "https://pacman.example.com/",
        headers: { host: "localhost:3000" },
      }),
    ).toBe("https://pacman.example.com");
  });

  it("uses forwarded proto/host behind a worldwide proxy", () => {
    expect(
      publicOrigin({
        headers: {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "arcade.fly.dev",
          host: "127.0.0.1:3000",
        },
      }),
    ).toBe("https://arcade.fly.dev");
  });

  it("falls back to a tunnel URL", () => {
    expect(
      publicOrigin({
        tunnelUrl: "https://abc.trycloudflare.com",
        headers: { host: "127.0.0.1:3000" },
      }),
    ).toBe("https://abc.trycloudflare.com");
  });

  it("builds an invite friends can open anywhere", () => {
    expect(inviteUrl("https://arcade.example.com", "k2m4")).toBe(
      "https://arcade.example.com/?join=K2M4",
    );
  });

  it("reads join codes from shared links", () => {
    expect(parseJoinCode("?join=ab12&x=1")).toBe("AB12");
    expect(parseJoinCode("code=zz9p")).toBe("ZZ9P");
  });
});
