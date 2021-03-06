import { CastingOverlay, User } from "@streamdota/shared-types";
import { Request, Response, Router } from "express";
import {
  fetchCurrentPatchHeroStats,
  fetchLeagueHeroStats,
} from "../../services/datdotaApi";
import {
  patchCastingOverlay,
  requireCastingOverlay,
} from "../../services/entity/CastingOverlay";

import { checkUserFrameAPIKey } from "../../middleware/frameApi";
import { requireAuthorization } from "../../middleware/requireAuthorization";
import { sendMessage } from "../../services/websocket";

const route = Router();

export default (app: Router) => {
  app.use("/casting", route);

  route.get(
    "/heroStats/:leagueId/:heroId",
    requireAuthorization,
    async (req: Request, res: Response) => {
      if ((req.user as User).twitchId !== 63202811) {
        return res.sendStatus(503);
      }
      let heroStats = null;
      const league =
        (req.user as User).castingStatsSource ?? req.params.leagueId;
      if (league.includes(".")) {
        heroStats = await fetchCurrentPatchHeroStats(+req.params.heroId);
      } else {
        heroStats = await fetchLeagueHeroStats(+league, +req.params.heroId);
      }

      if (heroStats === null) {
        return res.sendStatus(503);
      }

      return res.json(heroStats).status(200);
    }
  );

  route.get(
    "/settings",
    checkUserFrameAPIKey,
    requireAuthorization,
    async (req: Request, res: Response) => {
      const config = await requireCastingOverlay((req.user as User).id);
      return res.json(config).status(200);
    }
  );

  route.patch(
    "/settings",
    requireAuthorization,
    async (req: Request, res: Response) => {
      await patchCastingOverlay(
        (req.user as User).id,
        req.body as CastingOverlay
      );
      sendMessage((req.user as User).id, "overlay", true);
      return res.sendStatus(204);
    }
  );

  route.post(
    "/overlay",
    requireAuthorization,
    async (req: Request, res: Response) => {
      sendMessage((req.user as User).id, "statsoverlay", req.body);
      return res.sendStatus(201);
    }
  );
};
