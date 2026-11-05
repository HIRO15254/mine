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

export const schema = {
	account,
	accountRelations,
	calendarPreference,
	label,
	labelRelations,
	project,
	projectRelations,
	session,
	sessionRelations,
	task,
	taskCompletion,
	taskCompletionRelations,
	taskLabel,
	taskLabelRelations,
	taskRelations,
	user,
	userRelations,
	verification,
};
