<script setup lang="ts">
interface Article {
  id: string
  providerId: string
  title: string
  sentimentScore: number
  entities: string
  chargedAdjectives: string
}

interface Cluster {
  id: string
  target: string
  title: string
  articles: Article[]
  representativeSentiment: number
}

const { data: clusters, refresh, pending } = await useFetch<Cluster[]>('/api/articles/clusters', {
  baseURL: 'http://localhost:3002'
})

const handleRefresh = async () => {
  await refresh()
}

useHead({
  title: 'Delta Dashboard | Ground 0',
  meta: [
    { name: 'description', content: 'Visualizing version of the truth across Sri Lankan media.' }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            The Information Delta
            <UBadge
              variant="subtle"
              color="primary"
              class="font-mono"
            >
              PHASE 3
            </UBadge>
          </h1>
          <p class="text-neutral-500 mt-1">
            Cross-referencing {{ clusters?.length || 0 }} event clusters across state and private media.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="pending"
            @click="handleRefresh"
          >
            Refresh Data
          </UButton>
          <UButton
            to="/"
            color="neutral"
            variant="outline"
            icon="i-lucide-home"
          >
            Home
          </UButton>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Main Feed -->
        <div class="lg:col-span-8 space-y-8">
          <div
            v-if="!clusters || clusters.length === 0"
            class="text-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800"
          >
            <UIcon
              name="i-lucide-ghost"
              class="text-4xl text-neutral-300 mb-4"
            />
            <h2 class="text-xl font-bold">
              No clusters found
            </h2>
            <p class="text-neutral-500">
              Run the ingestion engine to gather data.
            </p>
          </div>

          <UCard
            v-for="cluster in clusters"
            :key="cluster.id"
            class="overflow-hidden border-none shadow-xl bg-white dark:bg-neutral-900"
          >
            <template #header>
              <div class="flex items-start justify-between gap-4">
                <div>
                  <UBadge
                    variant="subtle"
                    size="xs"
                    color="primary"
                    class="mb-2"
                  >
                    EVENT CLUSTER: {{ cluster.target }}
                  </UBadge>
                  <h2 class="text-xl font-bold leading-tight">
                    {{ cluster.title }}
                  </h2>
                </div>
                <div class="flex -space-x-2">
                  <div
                    v-for="article in cluster.articles"
                    :key="article.id"
                    v-tooltip="article.providerId"
                    class="w-8 h-8 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden"
                  >
                    {{ article.providerId.substring(0, 2) }}
                  </div>
                </div>
              </div>
            </template>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Left: Sentiment Spectrum -->
              <div>
                <h3 class="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                  <UIcon name="i-lucide-activity" />
                  Sentiment Spectrum
                </h3>
                <SentimentSpectrum :articles="cluster.articles" />
              </div>

              <!-- Right: Omission Alerts -->
              <div>
                <h3 class="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                  <UIcon name="i-lucide-alert-triangle" />
                  Fact Omissions
                </h3>
                <OmissionAlert :articles="cluster.articles" />
              </div>
            </div>

            <template #footer>
              <div class="flex justify-between items-center text-xs text-neutral-500">
                <span>{{ cluster.articles.length }} Sources reporting</span>
                <UButton
                  variant="link"
                  size="xs"
                  suffix-icon="i-lucide-chevron-right"
                >
                  Explore Raw Data
                </UButton>
              </div>
            </template>
          </UCard>
        </div>

        <!-- Sidebar / Ticker -->
        <div class="lg:col-span-4 space-y-6">
          <BiasTicker />

          <UCard class="bg-primary/5 border-primary/10">
            <h3 class="font-bold text-sm mb-2 flex items-center gap-2">
              <UIcon
                name="i-lucide-info"
                class="text-primary"
              />
              How it works
            </h3>
            <p class="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Our AI clusters news from multiple sources based on semantic embeddings. We then analyze each article relative to the primary target to detect framing bias and factual omissions.
            </p>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shadow-xl {
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05);
}
</style>
