CREATE TABLE `shipment_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`productId` int,
	`productName` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitCost` decimal(12,2) DEFAULT '0',
	`notes` text,
	CONSTRAINT `shipment_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`notes` text,
	`status` enum('pending','in_transit','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`shippingCost` decimal(12,2) DEFAULT '0',
	`currency` enum('USD','CUP') NOT NULL DEFAULT 'USD',
	`createdBy` int,
	`sentBy` int,
	`sentAt` timestamp,
	`receivedBy` int,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
