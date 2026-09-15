-- AddColumn
ALTER TABLE `Customer` ADD COLUMN `cep` VARCHAR(8) NULL;

-- AddIndex
CREATE INDEX `Customer_tenantId_cep_idx` ON `Customer`(`tenantId`, `cep`);
