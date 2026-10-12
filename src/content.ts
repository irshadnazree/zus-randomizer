export function getFaqs(total: number, regions: number, hasCoordinates: boolean) {
  return [
    {
      question: 'What is ZUS Roulette?',
      answer: 'ZUS Roulette is a free, unofficial ZUS Coffee outlet randomizer for Malaysia. It helps you choose which branch to visit by picking one outlet from the current directory, with an optional state filter.',
    },
    ...(hasCoordinates ? [{
      question: 'How do I find a random ZUS Coffee near me?',
      answer: 'Choose My location and allow your browser to access your location, or choose A place and enter a town, mall, or landmark in Malaysia. Select a radius of 2, 5, 10, or 25 km, then press Spin. Nearby results only include outlets with saved coordinates; distances are straight-line estimates, not driving distances.',
    }] : []),
    {
      question: 'Can I choose a ZUS Coffee outlet in a specific state?',
      answer: 'Yes. Select a state or federal territory before pressing Spin. The randomizer chooses from matching outlets. You can also browse the outlet directory for addresses and directions without spinning.',
    },
    {
      question: 'How many ZUS Coffee outlets are in this directory?',
      answer: `This directory currently lists ${total} outlets across ${regions} Malaysian states and federal territories. These counts describe our saved dataset, not a live total of every ZUS Coffee branch. Listings are sourced from the official ZUS Coffee store directory and can change.`,
    },
    {
      question: 'Does ZUS Roulette show opening hours or accept orders?',
      answer: 'No. ZUS Roulette helps you choose an outlet and open directions in Google Maps or Waze. It does not show live opening hours, stock, menus, or delivery availability, and it does not accept orders. Check official ZUS Coffee channels and the current map listing before travelling.',
    },
    {
      question: 'Is ZUS Roulette affiliated with ZUS Coffee?',
      answer: 'No. ZUS Roulette is an independent, unofficial fan project. It is not affiliated with or endorsed by ZUS Coffee.',
    },
  ]
}
