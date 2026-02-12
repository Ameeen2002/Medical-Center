-- CreateTable
CREATE TABLE "Center" (
    "idCenter" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("idCenter")
);

-- CreateTable
CREATE TABLE "User" (
    "idUser" SERIAL NOT NULL,
    "userName" TEXT NOT NULL,
    "passWord" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idCenter" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("idUser")
);

-- CreateTable
CREATE TABLE "Patients" (
    "idPatient" SERIAL NOT NULL,
    "ID" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "isPregnant" BOOLEAN NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "address" TEXT,
    "displacedAddress" TEXT,
    "medicalStatus" TEXT,
    "maritalStatus" TEXT NOT NULL,
    "hasDisability" BOOLEAN NOT NULL,
    "disabilityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patients_pkey" PRIMARY KEY ("idPatient")
);

-- CreateTable
CREATE TABLE "Visits" (
    "idVisit" UUID NOT NULL,
    "dateOfVisit" TIMESTAMP(3) NOT NULL,
    "idUser" INTEGER,
    "center" INTEGER,
    "serverType" TEXT NOT NULL,
    "idPatient" INTEGER NOT NULL,
    "idRate" INTEGER,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visits_pkey" PRIMARY KEY ("idVisit")
);

-- CreateTable
CREATE TABLE "VisitDocument" (
    "idVisit" UUID NOT NULL,
    "encryptedData" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitDocument_pkey" PRIMARY KEY ("idVisit")
);

-- CreateTable
CREATE TABLE "DoctorVisit" (
    "idDoctorVisit" SERIAL NOT NULL,
    "idVisit" UUID NOT NULL,
    "idUser" INTEGER NOT NULL,
    "needFurtherTest" BOOLEAN NOT NULL DEFAULT false,
    "isContagious" BOOLEAN NOT NULL DEFAULT false,
    "diagnosis" TEXT,
    "medications" TEXT,

    CONSTRAINT "DoctorVisit_pkey" PRIMARY KEY ("idDoctorVisit")
);

-- CreateTable
CREATE TABLE "NurseVisit" (
    "idNurseVisit" SERIAL NOT NULL,
    "idVisit" UUID NOT NULL,
    "idUser" INTEGER NOT NULL,
    "nurseNote" TEXT,

    CONSTRAINT "NurseVisit_pkey" PRIMARY KEY ("idNurseVisit")
);

-- CreateTable
CREATE TABLE "PharmacyDispense" (
    "idPharmacyDispense" SERIAL NOT NULL,
    "idVisit" UUID NOT NULL,
    "idMedicine" INTEGER NOT NULL,
    "quantityDispensed" INTEGER NOT NULL,
    "idUser" INTEGER NOT NULL,
    "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyDispense_pkey" PRIMARY KEY ("idPharmacyDispense")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "idMedicine" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("idMedicine")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patients_ID_key" ON "Patients"("ID");

-- CreateIndex
CREATE INDEX "Visits_idVisit_idx" ON "Visits"("idVisit");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorVisit_idVisit_key" ON "DoctorVisit"("idVisit");

-- CreateIndex
CREATE UNIQUE INDEX "NurseVisit_idVisit_key" ON "NurseVisit"("idVisit");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_idCenter_fkey" FOREIGN KEY ("idCenter") REFERENCES "Center"("idCenter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visits" ADD CONSTRAINT "Visits_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "User"("idUser") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visits" ADD CONSTRAINT "Visits_idPatient_fkey" FOREIGN KEY ("idPatient") REFERENCES "Patients"("idPatient") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visits" ADD CONSTRAINT "Visits_center_fkey" FOREIGN KEY ("center") REFERENCES "Center"("idCenter") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitDocument" ADD CONSTRAINT "VisitDocument_idVisit_fkey" FOREIGN KEY ("idVisit") REFERENCES "Visits"("idVisit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVisit" ADD CONSTRAINT "DoctorVisit_idVisit_fkey" FOREIGN KEY ("idVisit") REFERENCES "Visits"("idVisit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVisit" ADD CONSTRAINT "DoctorVisit_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "User"("idUser") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseVisit" ADD CONSTRAINT "NurseVisit_idVisit_fkey" FOREIGN KEY ("idVisit") REFERENCES "Visits"("idVisit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseVisit" ADD CONSTRAINT "NurseVisit_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "User"("idUser") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_idVisit_fkey" FOREIGN KEY ("idVisit") REFERENCES "Visits"("idVisit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "User"("idUser") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_idMedicine_fkey" FOREIGN KEY ("idMedicine") REFERENCES "Medicine"("idMedicine") ON DELETE RESTRICT ON UPDATE CASCADE;
