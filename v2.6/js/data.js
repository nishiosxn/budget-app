// V2.3 — template neutre. Aucune donnée financière personnelle n'est codée ici.
const DEFAULT_HOUSEHOLD={name:"Mon foyer",personB:"Personne 1",personA:"Personne 2",mode:"couple"};

const NEUTRAL_INCOME_TEMPLATE=[
  {id:"salary-b",name:"Salaire personne 1",budget:0,owner:"B"},
  {id:"salary-a",name:"Salaire personne 2",budget:0,owner:"A"},
  {id:"benefits",name:"Aides / allocations",budget:0,owner:"common"},
  {id:"extra-b",name:"Autre revenu personne 1",budget:0,owner:"B"},
  {id:"extra-a",name:"Autre revenu personne 2",budget:0,owner:"A"}
];

const NEUTRAL_EXPENSE_TEMPLATE=[
  {id:"rent",name:"Loyer / logement",budget:0,section:"Obligatoires",owner:"common"},
  {id:"electricity",name:"Électricité / énergie",budget:0,section:"Obligatoires",owner:"common"},
  {id:"groceries",name:"Courses",budget:0,section:"Obligatoires",owner:"common"},
  {id:"internet",name:"Internet",budget:0,section:"Obligatoires",owner:"common"},
  {id:"home-insurance",name:"Assurance habitation",budget:0,section:"Obligatoires",owner:"common"},
  {id:"car-insurance",name:"Assurance véhicule",budget:0,section:"Obligatoires",owner:"common"},
  {id:"phone-b",name:"Téléphone personne 1",budget:0,section:"Obligatoires",owner:"B"},
  {id:"phone-a",name:"Téléphone personne 2",budget:0,section:"Obligatoires",owner:"A"},
  {id:"fuel",name:"Transport / carburant",budget:0,section:"Obligatoires",owner:"common"},
  {id:"saving-b",name:"Épargne personne 1",budget:0,section:"Obligatoires",owner:"B",saving:true},
  {id:"saving-a",name:"Épargne personne 2",budget:0,section:"Obligatoires",owner:"A",saving:true},
  {id:"subscriptions",name:"Abonnements",budget:0,section:"Abonnements",owner:"common"},
  {id:"home-products",name:"Maison / produits ménagers",budget:0,section:"Vie courante",owner:"common"},
  {id:"health",name:"Santé / pharmacie",budget:0,section:"Vie courante",owner:"common"},
  {id:"clothes",name:"Vêtements / chaussures",budget:0,section:"Vie courante",owner:"common"},
  {id:"restaurants",name:"Restaurants / sorties",budget:0,section:"Vie courante",owner:"common"},
  {id:"leisure-b",name:"Loisirs personne 1",budget:0,section:"Vie courante",owner:"B"},
  {id:"leisure-a",name:"Loisirs personne 2",budget:0,section:"Vie courante",owner:"A"},
  {id:"gifts",name:"Cadeaux",budget:0,section:"Vie courante",owner:"common"},
  {id:"vacations",name:"Vacances / week-ends",budget:0,section:"Vie courante",owner:"common"},
  {id:"home-equipment",name:"Entretien / équipement logement",budget:0,section:"Vie courante",owner:"common"}
];

const INCOME_CATEGORIES=[];
const EXPENSE_CATEGORIES=[];
