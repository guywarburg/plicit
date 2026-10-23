CREATE TABLE `analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`raw_json` text NOT NULL,
	`created_ts` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chats` (
	`jid` text PRIMARY KEY NOT NULL,
	`name` text,
	`is_group` integer DEFAULT false NOT NULL,
	`last_message_ts` integer,
	`last_analyzed_ts` integer
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_jid` text NOT NULL,
	`started_ts` integer NOT NULL,
	`ended_ts` integer,
	`message_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`chat_jid`) REFERENCES `chats`(`jid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversations_chat_status_idx` ON `conversations` (`chat_jid`,`status`);--> statement-breakpoint
CREATE TABLE `daily_summaries` (
	`date` text PRIMARY KEY NOT NULL,
	`markdown_path` text NOT NULL,
	`generated_ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_jid` text NOT NULL,
	`sender_jid` text,
	`from_me` integer DEFAULT false NOT NULL,
	`ts` integer NOT NULL,
	`text` text,
	`media_type` text,
	`media_path` text,
	`raw_json` text NOT NULL,
	FOREIGN KEY (`chat_jid`) REFERENCES `chats`(`jid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_chat_ts_idx` ON `messages` (`chat_jid`,`ts`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analysis_id` integer NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_ts` integer NOT NULL,
	`decided_ts` integer,
	`executed_ref` text,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_items_status_idx` ON `review_items` (`status`);