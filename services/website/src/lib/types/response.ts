import { CreatorType, JoinStatus } from "./types";

export type JoinResponse = {
    jobId: string | null;
    message?: string; // *optional message for errors*
    status: JoinStatus;
    joinScriptUrl: string | null;
    authenticationUrl: string | null;
    authenticationTicket: string | null;
}

export type Game = {
    id: number;
    name: string;
    players: number;
    likes: number;
    dislikes: number;
    creatorName: string;
    creatorId: number;
    creatorType: CreatorType
};