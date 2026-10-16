import { getFaqs } from './content'
import { Randomizer, type RandomizerProps } from './randomizer'
import { Head, SITE_URL } from './seo'
import type { PageDocument } from './render'

export function Page(props: RandomizerProps): PageDocument {
  const faqs = getFaqs(props.total, props.states.length, props.hasCoordinates)
  return {
    head: (
      <Head
        title="ZUS Coffee Randomizer Malaysia | ZUS Roulette"
        description={`Pick a random ZUS Coffee in Malaysia from ${props.total} listed outlets. Filter by state or find a branch nearby, then open Google Maps or Waze directions.`}
        path="/"
        schema={[
          {
            '@type': 'WebApplication',
            '@id': `${SITE_URL}/#randomizer`,
            name: 'ZUS Roulette',
            alternateName: 'ZUS Coffee Randomizer',
            url: `${SITE_URL}/`,
            applicationCategory: 'LifestyleApplication',
            operatingSystem: 'Any',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'MYR' },
            description: faqs[0].answer,
          },
        ]}
      />
    ),
    body: <Randomizer {...props} />,
    randomizer: props,
  }
}
