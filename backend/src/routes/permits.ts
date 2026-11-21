import { Router } from 'express';
import { route } from '../http';
import { savePermit, type SaveDependencies } from '../permits/savePermit';
import { searchPermits } from '../permits/searchPermits';

export function createPermitsRouter(deps?: SaveDependencies) {
  const router = Router();

  router.post(
    '/permits',
    route('POST /permits', async (req, res) => {
      const permit = await savePermit(req.body, deps);
      res.status(201).json(permit);
    }),
  );

  router.get(
    '/permits/search',
    route('GET /permits/search', async (req, res) => {
      res.json(await searchPermits(req.query));
    }),
  );

  return router;
}
