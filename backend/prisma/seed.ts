import { PrismaClient, Role, LocationType, LocationStatus, POStatus, SOStatus, ReservationStatus, PickTaskStatus, MovementType, LotStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting StockPilot WMS deterministic seed...');

  // Clean existing data in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.returnOrderItem.deleteMany();
  await prisma.returnOrder.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.package.deleteMany();
  await prisma.pickTaskItem.deleteMany();
  await prisma.pickTask.deleteMany();
  await prisma.stockReservation.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.putAwayTask.deleteMany();
  await prisma.receiptItem.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.location.deleteMany();
  await prisma.warehouseMembership.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  console.log('[Seed] Purged existing tables.');

  // 1. Create Users
  const passwordHash = await bcrypt.hash('StockPilot2026!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@stockpilot.io',
      fullName: 'Alex Vance (Admin)',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@stockpilot.io',
      fullName: 'Sarah Chen (Ops Manager)',
      passwordHash,
      role: Role.WAREHOUSE_MANAGER,
    },
  });

  const specialist = await prisma.user.create({
    data: {
      email: 'inventory@stockpilot.io',
      fullName: 'David Morales (Inventory Lead)',
      passwordHash,
      role: Role.INVENTORY_SPECIALIST,
    },
  });

  const picker = await prisma.user.create({
    data: {
      email: 'picker@stockpilot.io',
      fullName: 'Marcus Bell (Fulfillment Associate)',
      passwordHash,
      role: Role.PICKER_PACKER,
    },
  });

  const clerk = await prisma.user.create({
    data: {
      email: 'receiving@stockpilot.io',
      fullName: 'Elena Rostova (Inbound Lead)',
      passwordHash,
      role: Role.RECEIVING_CLERK,
    },
  });

  console.log('[Seed] Created 5 operational user accounts.');

  // 2. Create Warehouses
  const edc = await prisma.warehouse.create({
    data: {
      code: 'EDC',
      name: 'East Coast Distribution Center',
      address: '450 Terminal Way, Port Logistics Area',
      city: 'Newark',
      state: 'NJ',
      postalCode: '07114',
      isDefault: true,
    },
  });

  const wcf = await prisma.warehouse.create({
    data: {
      code: 'WCF',
      name: 'West Coast Fulfillment Hub',
      address: '1820 Inland Empire Blvd, Suite 100',
      city: 'Ontario',
      state: 'CA',
      postalCode: '91764',
      isDefault: false,
    },
  });

  // Assign memberships
  for (const u of [admin, manager, specialist, picker, clerk]) {
    await prisma.warehouseMembership.createMany({
      data: [
        { userId: u.id, warehouseId: edc.id },
        { userId: u.id, warehouseId: wcf.id },
      ],
    });
  }

  console.log('[Seed] Created 2 warehouses: EDC & WCF.');

  // 3. Create Hierarchical Locations for both warehouses
  const createLocationsForWarehouse = async (warehouseId: string, prefix: string) => {
    const locs: any[] = [];

    // Inbound receiving docks
    locs.push(
      {
        warehouseId,
        zone: 'INB',
        aisle: '01',
        rack: '01',
        shelf: '1',
        bin: '01',
        code: `${prefix}-RCV-DOCK-01`,
        barcode: `LOC-${prefix}-RCV-01`,
        type: LocationType.RECEIVING,
        capacityUnits: 5000,
      },
      {
        warehouseId,
        zone: 'INB',
        aisle: '01',
        rack: '02',
        shelf: '1',
        bin: '01',
        code: `${prefix}-RCV-DOCK-02`,
        barcode: `LOC-${prefix}-RCV-02`,
        type: LocationType.RECEIVING,
        capacityUnits: 5000,
      }
    );

    // Forward picking bins: Zone A (Fast Movers)
    for (let a = 1; a <= 2; a++) {
      for (let r = 1; r <= 3; r++) {
        for (let b = 1; b <= 4; b++) {
          const code = `${prefix}-ZA-A0${a}-R0${r}-S1-B0${b}`;
          locs.push({
            warehouseId,
            zone: 'ZA',
            aisle: `0${a}`,
            rack: `0${r}`,
            shelf: '1',
            bin: `0${b}`,
            code,
            barcode: `LOC-${code}`,
            type: LocationType.PICKING,
            capacityUnits: 800,
          });
        }
      }
    }

    // Bulk Storage racks: Zone B (Pallet Reserve)
    for (let a = 1; a <= 2; a++) {
      for (let r = 1; r <= 3; r++) {
        for (let s = 1; s <= 3; s++) {
          for (let b = 1; b <= 2; b++) {
            const code = `${prefix}-ZB-A0${a}-R0${r}-S0${s}-B0${b}`;
            locs.push({
              warehouseId,
              zone: 'ZB',
              aisle: `0${a}`,
              rack: `0${r}`,
              shelf: `0${s}`,
              bin: `0${b}`,
              code,
              barcode: `LOC-${code}`,
              type: LocationType.STORAGE,
              capacityUnits: 2500,
            });
          }
        }
      }
    }

    // Packing & Shipping
    locs.push(
      {
        warehouseId,
        zone: 'OUT',
        aisle: '01',
        rack: '01',
        shelf: '1',
        bin: '01',
        code: `${prefix}-PCK-STATION-01`,
        barcode: `LOC-${prefix}-PCK-01`,
        type: LocationType.PACKING,
        capacityUnits: 1500,
      },
      {
        warehouseId,
        zone: 'OUT',
        aisle: '02',
        rack: '01',
        shelf: '1',
        bin: '01',
        code: `${prefix}-SHP-STAGING-01`,
        barcode: `LOC-${prefix}-SHP-01`,
        type: LocationType.SHIPPING,
        capacityUnits: 4000,
      },
      {
        warehouseId,
        zone: 'QRT',
        aisle: '01',
        rack: '01',
        shelf: '1',
        bin: '01',
        code: `${prefix}-QRT-BAY-01`,
        barcode: `LOC-${prefix}-QRT-01`,
        type: LocationType.QUARANTINE,
        capacityUnits: 1000,
      }
    );

    await prisma.location.createMany({ data: locs });
  };

  await createLocationsForWarehouse(edc.id, 'EDC');
  await createLocationsForWarehouse(wcf.id, 'WCF');

  const edcLocations = await prisma.location.findMany({ where: { warehouseId: edc.id } });
  const wcfLocations = await prisma.location.findMany({ where: { warehouseId: wcf.id } });

  console.log(`[Seed] Created ${edcLocations.length + wcfLocations.length} locations across EDC & WCF.`);

  // 4. Create Categories
  const catElec = await prisma.category.create({
    data: { code: 'ELEC', name: 'Industrial Electronics', description: 'Sensors, PLCs, drives, and controllers' },
  });
  const catSafe = await prisma.category.create({
    data: { code: 'SAFE', name: 'Safety Equipment & PPE', description: 'Helmets, respirators, harnesses, gloves' },
  });
  const catTool = await prisma.category.create({
    data: { code: 'TOOL', name: 'Precision MRO Tools', description: 'Torque wrenches, calipers, cutting bits' },
  });
  const catPack = await prisma.category.create({
    data: { code: 'PACK', name: 'Packaging & Shipping', description: 'Corrugated cartons, bubble rolls, poly straps' },
  });
  const catChem = await prisma.category.create({
    data: { code: 'CHEM', name: 'Industrial Chemicals', description: 'Lubricants, sealants, coolants, solvents' },
  });

  // 5. Create 50+ Deterministic Products
  const productDefinitions = [
    // Electronics
    { sku: 'EL-SEN-001', name: 'Photoelectric Proximity Sensor 24V', cat: catElec.id, uom: 'EA', cost: 42.5, price: 89.0, min: 20, target: 120 },
    { sku: 'EL-SEN-002', name: 'Ultrasonic Distance Sensor M18', cat: catElec.id, uom: 'EA', cost: 68.0, price: 145.0, min: 15, target: 80 },
    { sku: 'EL-PLC-101', name: 'Micro-PLC 16 I/O Digital Controller', cat: catElec.id, uom: 'EA', cost: 210.0, price: 395.0, min: 10, target: 50 },
    { sku: 'EL-DRV-201', name: 'Variable Frequency Drive 2.2kW 3-Phase', cat: catElec.id, uom: 'EA', cost: 185.0, price: 340.0, min: 8, target: 40 },
    { sku: 'EL-REL-010', name: 'Industrial Solid State Relay 40A', cat: catElec.id, uom: 'BOX', cost: 55.0, price: 110.0, min: 25, target: 150 },
    { sku: 'EL-PWR-024', name: 'DIN-Rail Power Supply 24VDC 10A', cat: catElec.id, uom: 'EA', cost: 74.0, price: 140.0, min: 12, target: 70 },
    { sku: 'EL-ENC-301', name: 'Optical Rotary Encoder 1024 PPR', cat: catElec.id, uom: 'EA', cost: 95.0, price: 195.0, min: 10, target: 45 },
    { sku: 'EL-CBL-401', name: 'Shielded M12 Sensor Cable 5m', cat: catElec.id, uom: 'BOX', cost: 32.0, price: 65.0, min: 30, target: 200 },
    { sku: 'EL-HMI-700', name: '7-inch Industrial Touchscreen HMI Panel', cat: catElec.id, uom: 'EA', cost: 310.0, price: 580.0, min: 5, target: 30 },
    { sku: 'EL-BRK-100', name: 'Miniature Circuit Breaker 3-Pole 32A', cat: catElec.id, uom: 'EA', cost: 22.0, price: 48.0, min: 40, target: 250 },

    // Safety Equipment
    { sku: 'SF-HLM-001', name: 'Vented Industrial Hard Hat (White)', cat: catSafe.id, uom: 'EA', cost: 18.0, price: 36.0, min: 35, target: 200 },
    { sku: 'SF-HLM-002', name: 'Non-Vented Electrical Hard Hat (Yellow)', cat: catSafe.id, uom: 'EA', cost: 22.0, price: 44.0, min: 25, target: 150 },
    { sku: 'SF-GLV-101', name: 'Cut-Resistant Nitrile Gloves (L - 12pk)', cat: catSafe.id, uom: 'BOX', cost: 28.0, price: 58.0, min: 30, target: 180 },
    { sku: 'SF-GLV-102', name: 'High-Dexterity Work Gloves (XL - 12pk)', cat: catSafe.id, uom: 'BOX', cost: 24.0, price: 50.0, min: 25, target: 160 },
    { sku: 'SF-RSP-201', name: 'N95 Particulate Respirator Box (20pk)', cat: catSafe.id, uom: 'BOX', cost: 16.5, price: 34.0, min: 40, target: 300 },
    { sku: 'SF-HRN-301', name: 'Full Body Fall Protection Safety Harness', cat: catSafe.id, uom: 'EA', cost: 85.0, price: 165.0, min: 10, target: 60 },
    { sku: 'SF-LAN-302', name: 'Shock-Absorbing Double Lanyard 6ft', cat: catSafe.id, uom: 'EA', cost: 48.0, price: 95.0, min: 15, target: 75 },
    { sku: 'SF-EYE-401', name: 'Anti-Fog Ballistic Safety Glasses', cat: catSafe.id, uom: 'BOX', cost: 35.0, price: 72.0, min: 30, target: 180 },
    { sku: 'SF-EAR-501', name: 'Corded Foam Earplugs (100-pair Dispenser)', cat: catSafe.id, uom: 'BOX', cost: 21.0, price: 45.0, min: 25, target: 140 },
    { sku: 'SF-VST-601', name: 'High-Visibility Class 2 Safety Vest (L)', cat: catSafe.id, uom: 'EA', cost: 9.5, price: 21.0, min: 50, target: 300 },

    // Precision Tools
    { sku: 'TL-TRQ-001', name: 'Digital Torque Wrench 1/2" 20-250 Nm', cat: catTool.id, uom: 'EA', cost: 145.0, price: 280.0, min: 8, target: 40 },
    { sku: 'TL-CAL-002', name: 'Electronic Digital Caliper 150mm IP67', cat: catTool.id, uom: 'EA', cost: 65.0, price: 125.0, min: 12, target: 65 },
    { sku: 'TL-MIC-003', name: 'External Precision Micrometer 0-25mm', cat: catTool.id, uom: 'EA', cost: 72.0, price: 135.0, min: 10, target: 50 },
    { sku: 'TL-SKT-010', name: 'Impact Socket Master Set 3/8" Drive', cat: catTool.id, uom: 'EA', cost: 89.0, price: 175.0, min: 15, target: 80 },
    { sku: 'TL-DRI-020', name: 'Cobalt Drill Bit Set 1mm-13mm (25pc)', cat: catTool.id, uom: 'EA', cost: 58.0, price: 115.0, min: 20, target: 100 },
    { sku: 'TL-PRY-030', name: 'Heavy Duty Curved Pry Bar Set 4pc', cat: catTool.id, uom: 'EA', cost: 38.0, price: 75.0, min: 15, target: 90 },
    { sku: 'TL-HEX-040', name: 'Metric T-Handle Hex Key Set 2-10mm', cat: catTool.id, uom: 'EA', cost: 28.0, price: 56.0, min: 25, target: 120 },
    { sku: 'TL-CRF-050', name: 'Pneumatic 1/4" Die Grinder 25000 RPM', cat: catTool.id, uom: 'EA', cost: 92.0, price: 180.0, min: 10, target: 50 },
    { sku: 'TL-MLT-060', name: 'True-RMS Digital Multimeter 1000V Cat IV', cat: catTool.id, uom: 'EA', cost: 160.0, price: 310.0, min: 12, target: 60 },
    { sku: 'TL-LAS-070', name: 'Cross-Line Self-Leveling Laser Level', cat: catTool.id, uom: 'EA', cost: 115.0, price: 220.0, min: 8, target: 45 },

    // Packaging & Shipping
    { sku: 'PK-BX-101', name: 'Corrugated Shipping Box 12x10x8 (25pk)', cat: catPack.id, uom: 'BOX', cost: 19.5, price: 39.0, min: 40, target: 300 },
    { sku: 'PK-BX-102', name: 'Corrugated Shipping Box 18x14x12 (20pk)', cat: catPack.id, uom: 'BOX', cost: 26.0, price: 52.0, min: 35, target: 250 },
    { sku: 'PK-BX-103', name: 'Heavy Duty Double-Wall Box 24x20x18 (10pk)', cat: catPack.id, uom: 'BOX', cost: 34.0, price: 68.0, min: 25, target: 180 },
    { sku: 'PK-BBL-201', name: 'Bubble Cushioning Roll 12" x 175ft', cat: catPack.id, uom: 'EA', cost: 21.0, price: 42.0, min: 30, target: 160 },
    { sku: 'PK-STP-301', name: 'Poly Strapping Kit 1/2" with Buckles', cat: catPack.id, uom: 'EA', cost: 48.0, price: 95.0, min: 15, target: 80 },
    { sku: 'PK-TP-401', name: 'Industrial Packing Tape 2" x 110yd (6pk)', cat: catPack.id, uom: 'BOX', cost: 14.0, price: 29.0, min: 50, target: 400 },
    { sku: 'PK-STR-501', name: 'Cast Stretch Film 18" x 1500ft 80 Gauge (4pk)', cat: catPack.id, uom: 'BOX', cost: 58.0, price: 118.0, min: 20, target: 120 },
    { sku: 'PK-LBL-601', name: 'Thermal Transfer Shipping Labels 4x6 (1000/roll)', cat: catPack.id, uom: 'BOX', cost: 18.0, price: 38.0, min: 40, target: 300 },
    { sku: 'PK-PLT-701', name: 'Standard GMA Pallet 48x40 Heavy Duty', cat: catPack.id, uom: 'PLT', cost: 24.0, price: 45.0, min: 30, target: 150 },
    { sku: 'PK-BAG-801', name: 'Anti-Static ESD Shielding Bags 8x10 (100pk)', cat: catPack.id, uom: 'BOX', cost: 27.5, price: 55.0, min: 20, target: 120 },

    // Chemicals & Lubricants (With Lots & Expiry)
    { sku: 'CH-LUB-001', name: 'Synthetic ISO VG 220 Gear Oil (5 Gal)', cat: catChem.id, uom: 'EA', cost: 110.0, price: 215.0, min: 10, target: 60 },
    { sku: 'CH-LUB-002', name: 'High-Temperature EP2 Lithium Grease (10 Cartridges)', cat: catChem.id, uom: 'BOX', cost: 38.0, price: 78.0, min: 20, target: 120 },
    { sku: 'CH-HYD-010', name: 'Anti-Wear Hydraulic Oil ISO 46 (55 Gal Drum)', cat: catChem.id, uom: 'EA', cost: 380.0, price: 690.0, min: 4, target: 20 },
    { sku: 'CH-SLV-020', name: 'Fast-Evaporating Precision Degreaser 14oz (12pk)', cat: catChem.id, uom: 'BOX', cost: 62.0, price: 124.0, min: 18, target: 90 },
    { sku: 'CH-SLT-030', name: 'Threadlocker Medium Strength Blue 50ml (6pk)', cat: catChem.id, uom: 'BOX', cost: 45.0, price: 92.0, min: 15, target: 80 },
    { sku: 'CH-CLN-040', name: 'Multi-Surface Plant Floor Cleaner Concentrate (5 Gal)', cat: catChem.id, uom: 'EA', cost: 35.0, price: 72.0, min: 15, target: 70 },
    { sku: 'CH-RST-050', name: 'Heavy Duty Corrosion Inhibitor Spray 16oz (12pk)', cat: catChem.id, uom: 'BOX', cost: 54.0, price: 108.0, min: 14, target: 75 },
    { sku: 'CH-ADH-060', name: 'Industrial Cyanoacrylate Adhesive 20g (10pk)', cat: catChem.id, uom: 'BOX', cost: 42.0, price: 85.0, min: 20, target: 100 },
    { sku: 'CH-COL-070', name: 'Synthetic CNC Machine Coolant 5 Gal', cat: catChem.id, uom: 'EA', cost: 88.0, price: 168.0, min: 8, target: 40 },
    { sku: 'CH-SIL-080', name: 'Food Grade Silicone Lubricant 11oz (12pk)', cat: catChem.id, uom: 'BOX', cost: 50.0, price: 100.0, min: 16, target: 80 },
  ];

  const createdProducts: any[] = [];
  for (const def of productDefinitions) {
    const p = await prisma.product.create({
      data: {
        sku: def.sku,
        name: def.name,
        categoryId: def.cat,
        uom: def.uom,
        barcode: `SKU-${def.sku}`,
        minReorderPoint: def.min,
        targetStock: def.target,
        unitCost: def.cost,
        unitPrice: def.price,
      },
    });
    createdProducts.push(p);
  }

  console.log(`[Seed] Created ${createdProducts.length} deterministic industrial products.`);

  // 6. Create Lots (including active, near-expiry, and expired lots for chemical products)
  const chemProducts = createdProducts.filter((p) => p.sku.startsWith('CH-'));

  const lotActive = await prisma.lot.create({
    data: {
      productId: chemProducts[0].id,
      lotNumber: 'LOT-2026-A104',
      manufactureDate: new Date('2026-01-10'),
      expiryDate: new Date('2027-01-10'),
      status: LotStatus.ACTIVE,
    },
  });

  const lotNearExpiry = await prisma.lot.create({
    data: {
      productId: chemProducts[1].id,
      lotNumber: 'LOT-2025-E889',
      manufactureDate: new Date('2025-10-20'),
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days left
      status: LotStatus.ACTIVE,
    },
  });

  const lotExpired = await prisma.lot.create({
    data: {
      productId: chemProducts[2].id,
      lotNumber: 'LOT-2024-X402',
      manufactureDate: new Date('2024-06-01'),
      expiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
      status: LotStatus.EXPIRED,
    },
  });

  console.log('[Seed] Created deterministic Lots (active, near-expiry, expired).');

  // 7. Seed Inventory Balances & Movements across EDC and WCF
  const edcStorageLocs = edcLocations.filter((l) => l.type === LocationType.STORAGE || l.type === LocationType.PICKING);
  const wcfStorageLocs = wcfLocations.filter((l) => l.type === LocationType.STORAGE || l.type === LocationType.PICKING);

  let movementCounter = 1;

  for (let i = 0; i < createdProducts.length; i++) {
    const prod = createdProducts[i];
    const edcLoc = edcStorageLocs[i % edcStorageLocs.length];
    const wcfLoc = wcfStorageLocs[i % wcfStorageLocs.length];

    // Some items will intentionally be seeded below minReorderPoint for low stock alerts
    const isLowStock = i === 3 || i === 7 || i === 18 || i === 34 || i === 48;
    const edcQty = isLowStock ? Math.floor(prod.minReorderPoint * 0.4) : Math.floor(prod.targetStock * 0.7);
    const wcfQty = isLowStock ? 0 : Math.floor(prod.targetStock * 0.5);

    let lotId: string | null = null;
    if (prod.id === chemProducts[0].id) lotId = lotActive.id;
    if (prod.id === chemProducts[1].id) lotId = lotNearExpiry.id;
    if (prod.id === chemProducts[2].id) lotId = lotExpired.id;

    // Seed EDC balance
    const edcBalance = await prisma.inventoryBalance.create({
      data: {
        warehouseId: edc.id,
        locationId: edcLoc.id,
        productId: prod.id,
        lotId,
        onHand: edcQty,
        reserved: 0,
        damaged: 0,
      },
    });

    await prisma.stockMovement.create({
      data: {
        referenceType: MovementType.PURCHASE_RECEIPT,
        referenceId: `SEED-INB-${String(movementCounter++).padStart(4, '0')}`,
        productId: prod.id,
        lotId,
        sourceLocationId: null,
        destinationLocationId: edcLoc.id,
        quantity: edcQty,
        balanceBefore: 0,
        balanceAfter: edcQty,
        userId: admin.id,
        reason: 'Initial System Stock Verification & Setup',
      },
    });

    // Seed WCF balance
    if (wcfQty > 0) {
      await prisma.inventoryBalance.create({
        data: {
          warehouseId: wcf.id,
          locationId: wcfLoc.id,
          productId: prod.id,
          lotId,
          onHand: wcfQty,
          reserved: 0,
          damaged: 0,
        },
      });

      await prisma.stockMovement.create({
        data: {
          referenceType: MovementType.PURCHASE_RECEIPT,
          referenceId: `SEED-INB-${String(movementCounter++).padStart(4, '0')}`,
          productId: prod.id,
          lotId,
          sourceLocationId: null,
          destinationLocationId: wcfLoc.id,
          quantity: wcfQty,
          balanceBefore: 0,
          balanceAfter: wcfQty,
          userId: admin.id,
          reason: 'Initial System Stock Verification & Setup',
        },
      });
    }
  }

  console.log('[Seed] Reconciled initial inventory balances and movement logs.');

  // 8. Create Suppliers
  const supApex = await prisma.supplier.create({
    data: {
      code: 'SUP-APEX',
      name: 'Apex Industrial Supply Co.',
      contactEmail: 'orders@apexindustrial.com',
      phone: '+1 (555) 234-5678',
      address: '900 Factory Rd, Cleveland, OH',
    },
  });

  const supTitan = await prisma.supplier.create({
    data: {
      code: 'SUP-TITAN',
      name: 'Titan Packaging & Container Corp',
      contactEmail: 'procurement@titanpkg.com',
      phone: '+1 (555) 876-5432',
      address: '1400 Paper Mill Way, Atlanta, GA',
    },
  });

  const supSafe = await prisma.supplier.create({
    data: {
      code: 'SUP-SAFE',
      name: 'Global Safety Direct LLC',
      contactEmail: 'sales@globalsafetydirect.com',
      phone: '+1 (555) 345-6789',
      address: '220 Harbor Blvd, Long Beach, CA',
    },
  });

  // 9. Create Customers
  const custNexus = await prisma.customer.create({
    data: {
      code: 'CUST-NEXUS',
      name: 'Nexus Logistics International',
      email: 'operations@nexuslogistics.com',
      phone: '+1 (555) 987-6543',
      shippingAddress: '780 Cargo Way, Dock 4',
      city: 'Elizabeth',
      state: 'NJ',
      postalCode: '07201',
    },
  });

  const custVantage = await prisma.customer.create({
    data: {
      code: 'CUST-VANTAGE',
      name: 'Vantage Precision Manufacturing',
      email: 'purchasing@vantagemfg.com',
      phone: '+1 (555) 654-3210',
      shippingAddress: '410 Industrial Parkway',
      city: 'Riverside',
      state: 'CA',
      postalCode: '92501',
    },
  });

  const custHorizon = await prisma.customer.create({
    data: {
      code: 'CUST-HORIZON',
      name: 'Horizon Robotics & Automation Inc.',
      email: 'supplychain@horizonrobotics.io',
      phone: '+1 (555) 432-1098',
      shippingAddress: '120 Innovation Drive, Bay 2',
      city: 'Boston',
      state: 'MA',
      postalCode: '02110',
    },
  });

  console.log('[Seed] Created suppliers and commercial customers.');

  // 10. Create Purchase Orders with Inbound Receipts
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0001',
      supplierId: supApex.id,
      warehouseId: edc.id,
      status: POStatus.RECEIVED,
      expectedDate: new Date('2026-10-10'),
      notes: 'Initial restock for industrial sensors and controllers',
      createdById: clerk.id,
      items: {
        create: [
          { productId: createdProducts[0].id, expectedQty: 50, receivedQty: 50, unitCost: 42.5 },
          { productId: createdProducts[1].id, expectedQty: 30, receivedQty: 30, unitCost: 68.0 },
        ],
      },
    },
  });

  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0002',
      supplierId: supTitan.id,
      warehouseId: edc.id,
      status: POStatus.ORDERED,
      expectedDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      notes: 'Q4 bulk packaging cartons delivery scheduled',
      createdById: specialist.id,
      items: {
        create: [
          { productId: createdProducts[30].id, expectedQty: 100, receivedQty: 0, unitCost: 19.5 },
          { productId: createdProducts[31].id, expectedQty: 80, receivedQty: 0, unitCost: 26.0 },
        ],
      },
    },
  });

  const po3 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0003',
      supplierId: supSafe.id,
      warehouseId: wcf.id,
      status: POStatus.PARTIALLY_RECEIVED,
      expectedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      notes: 'PPE expedited air shipment for West Coast fulfillment',
      createdById: clerk.id,
      items: {
        create: [
          { productId: createdProducts[10].id, expectedQty: 60, receivedQty: 30, unitCost: 18.0 },
          { productId: createdProducts[12].id, expectedQty: 50, receivedQty: 0, unitCost: 28.0 },
        ],
      },
    },
  });

  console.log('[Seed] Created Purchase Orders in ORDERED, PARTIALLY_RECEIVED, and RECEIVED states.');

  // 11. Create Sales Orders with Lifecycles
  // SO 1: PENDING
  await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-2026-0001',
      customerId: custNexus.id,
      warehouseId: edc.id,
      status: SOStatus.PENDING,
      requiredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      shippingCarrier: 'FedEx Freight',
      createdById: manager.id,
      items: {
        create: [
          { productId: createdProducts[0].id, requestedQty: 5, unitPrice: 89.0 },
          { productId: createdProducts[10].id, requestedQty: 10, unitPrice: 36.0 },
        ],
      },
    },
  });

  // SO 2: ALLOCATED (Stock reserved)
  const targetProd = createdProducts[0];
  const targetBal = await prisma.inventoryBalance.findFirst({
    where: { warehouseId: edc.id, productId: targetProd.id },
  });

  if (targetBal) {
    const qtyToReserve = 4;
    await prisma.inventoryBalance.update({
      where: { id: targetBal.id },
      data: { reserved: targetBal.reserved + qtyToReserve },
    });

    const so2 = await prisma.salesOrder.create({
      data: {
        orderNumber: 'SO-2026-0002',
        customerId: custVantage.id,
        warehouseId: edc.id,
        status: SOStatus.ALLOCATED,
        requiredDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        shippingCarrier: 'UPS Ground',
        createdById: manager.id,
        items: {
          create: [
            { productId: targetProd.id, requestedQty: qtyToReserve, allocatedQty: qtyToReserve, unitPrice: 89.0 },
          ],
        },
      },
      include: { items: true },
    });

    await prisma.stockReservation.create({
      data: {
        salesOrderId: so2.id,
        salesOrderItemId: so2.items[0].id,
        productId: targetProd.id,
        warehouseId: edc.id,
        locationId: targetBal.locationId,
        reservedQty: qtyToReserve,
        status: ReservationStatus.ACTIVE,
      },
    });

    // Create Pick Task for SO 2
    await prisma.pickTask.create({
      data: {
        taskNumber: 'PCK-2026-0001',
        salesOrderId: so2.id,
        status: PickTaskStatus.PENDING,
        assignedToId: picker.id,
        items: {
          create: [
            {
              salesOrderItemId: so2.items[0].id,
              productId: targetProd.id,
              locationId: targetBal.locationId,
              targetQty: qtyToReserve,
              pickedQty: 0,
            },
          ],
        },
      },
    });
  }

  // SO 3: SHIPPED
  const so3 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-2026-0003',
      customerId: custHorizon.id,
      warehouseId: edc.id,
      status: SOStatus.SHIPPED,
      shippingCarrier: 'DHL Express',
      trackingNumber: 'DHL-8472910482',
      createdById: manager.id,
      items: {
        create: [
          { productId: createdProducts[2].id, requestedQty: 2, allocatedQty: 2, pickedQty: 2, packedQty: 2, unitPrice: 395.0 },
        ],
      },
    },
  });

  const pkg3 = await prisma.package.create({
    data: {
      packageNumber: 'PKG-2026-0001',
      salesOrderId: so3.id,
      weightKg: 3.2,
      boxType: 'STANDARD_CORRUGATED',
      packedById: picker.id,
      trackingNumber: 'DHL-8472910482',
    },
  });

  await prisma.shipment.create({
    data: {
      shipmentNumber: 'SHP-2026-0001',
      salesOrderId: so3.id,
      packageId: pkg3.id,
      carrier: 'DHL Express',
      trackingNumber: 'DHL-8472910482',
      dispatchedById: manager.id,
      dispatchedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  console.log('[Seed] Created Sales Orders across PENDING, ALLOCATED, and SHIPPED lifecycles.');
  console.log('[Seed] Deterministic seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
