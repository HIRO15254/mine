import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "./schema/auth";
import { calendarPreference } from "./schema/calendar";

export const schema = {
	account,
	accountRelations,
	calendarPreference,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
};
