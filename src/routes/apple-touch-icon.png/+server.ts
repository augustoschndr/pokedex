import { appleTouchAsset, iconResponse } from '$lib/server/icon-assets';
import { ROOT_TOUCH_CACHE } from '$lib/icons';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => iconResponse(appleTouchAsset, ROOT_TOUCH_CACHE, 'image/png');
