<script setup lang="ts">
interface Article {
  id: string
  providerId: string
  entities: string
}

const props = defineProps<{
  articles: Article[]
}>()

// Simple omission logic: Entities found in some articles but not others
const allEntities = computed(() => {
  const map = new Map<string, string[]>() // entity -> providers who mentioned it
  props.articles.forEach(a => {
    const entities = JSON.parse(a.entities || '[]')
    entities.forEach(e => {
      const providers = map.get(e) || []
      if (!providers.includes(a.providerId)) {
        providers.push(a.providerId)
      }
      map.set(e, providers)
    })
  })
  return map
})

const omissions = computed(() => {
  const list = []
  for (const [entity, providers] of allEntities.value.entries()) {
    if (providers.length < props.articles.length) {
      const missing = props.articles
        .map(a => a.providerId)
        .filter(p => !providers.includes(p))

      list.push({
        entity,
        mentionedBy: providers,
        missingIn: missing
      })
    }
  }
  return list.sort((a, b) => b.mentionedBy.length - a.mentionedBy.length)
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="omissions.length === 0"
      class="text-center py-8 text-neutral-500 italic text-sm"
    >
      No significant info deltas detected in this cluster.
    </div>

    <div
      v-for="item in omissions.slice(0, 5)"
      :key="item.entity"
      class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="font-bold text-sm">{{ item.entity }}</span>
        <UBadge
          color="error"
          variant="subtle"
          size="xs"
        >
          Omission Alert
        </UBadge>
      </div>

      <div class="space-y-2">
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">
            Mentioned:
          </span>
          <UBadge
            v-for="p in item.mentionedBy"
            :key="p"
            variant="soft"
            size="xs"
            color="success"
          >
            {{ p }}
          </UBadge>
        </div>

        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">
            Not Mentioned:
          </span>
          <UBadge
            v-for="p in item.missingIn"
            :key="p"
            variant="soft"
            size="xs"
            color="error"
          >
            {{ p }}
          </UBadge>
        </div>
      </div>
    </div>
  </div>
</template>
