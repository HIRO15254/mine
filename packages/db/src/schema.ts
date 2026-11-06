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
