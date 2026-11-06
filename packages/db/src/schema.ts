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
import {
	oauthClient,
	oauthCode,
	oauthGrant,
	oauthGrantRelations,
} from "./schema/oauth";
import {
	label,
	labelRelations,
	project,
	projectRelations,
	task,
	taskCompletion,
	taskCompletionRelations,
	taskLabel,
	taskLabelRelations,
	taskRelations,
} from "./schema/tasks";
import {
	projectRate,
	projectRateRelations,
	timeEntry,
	timeEntryRelations,
} from "./schema/time";
import { apiToken } from "./schema/token";

export const schema = {
	account,
	apiToken,
	accountRelations,
	calendarPreference,
	label,
	labelRelations,
	oauthClient,
	oauthCode,
	oauthGrant,
	oauthGrantRelations,
	project,
	projectRate,
	projectRateRelations,
	projectRelations,
	session,
	sessionRelations,
	task,
	taskCompletion,
	taskCompletionRelations,
	taskLabel,
	taskLabelRelations,
	taskRelations,
	timeEntry,
	timeEntryRelations,
	user,
	userRelations,
	verification,
};
