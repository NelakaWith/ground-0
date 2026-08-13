<script setup lang="ts">
interface Article {
  id: string;
  providerId: string;
  title: string;
  sentimentScore: number;
  entities: string;
  chargedAdjectives: string;
  fullText: string;
  url: string;
}

const {
  data: articles,
  refresh,
  pending,
} = await useFetch<Article[]>('/api/articles', {
  baseURL: 'http://localhost:3000',
});

const handleRefresh = async () => {
  await refresh();
};

useHead({
  title: 'Delta Dashboard | Ground 0',
  meta: [
    {
      name: 'description',
      content: 'Visualizing version of the truth across Sri Lankan media.',
    },
  ],
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header
        class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1
            class="text-3xl font-extrabold tracking-tight flex items-center gap-3"
          >
            Articles {{ articles?.length }}
          </h1>
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
      <div>
        <!-- <pre>{{ articles }}</pre> -->
        <template
          v-for="article in articles"
          :key="article.id"
        >
          <UCard
            variant="subtle"
            class="my-4"
          >
            <template #header>
              {{ article.title }}
              <br />
              <small>{{ article.providerId }}</small>
            </template>
            <div class="whitespace-pre-wrap">
              {{ article.fullText }}
            </div>
            <template #footer>
              <a
                :href="article.url"
                target="_blank"
              >
                Go to source
              </a>
            </template>
          </UCard>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shadow-xl {
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.05),
    0 8px 10px -6px rgb(0 0 0 / 0.05);
}
</style>
